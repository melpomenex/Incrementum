use core::fmt::Debug;

use approx::{assert_relative_eq, RelativeEq};
use bytemuck::Zeroable;
use rand::{
    distr::{uniform::SampleUniform, Uniform},
    Rng,
};

use crate::{vload_unaligned, vstore_unaligned, Scalar, Simd, Vector};

mod arithmetic;
mod bitwise;
mod ord;
mod reduce;
mod unary;

wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

const SIZE: usize = 128;
fn random<T: SampleUniform>(lo: T, hi: T) -> Vec<T> {
    let distribution = Uniform::new(lo, hi).unwrap();
    rand::rng().sample_iter(&distribution).take(SIZE).collect()
}

fn random_of_size<T: SampleUniform>(lo: T, hi: T, size: usize) -> Vec<T> {
    let distribution = Uniform::new(lo, hi).unwrap();
    rand::rng().sample_iter(&distribution).take(size).collect()
}

fn assert_approx_eq<T: RelativeEq + Debug>(lhs: &[T], rhs: &[T]) {
    for (a, b) in lhs.iter().zip(rhs) {
        assert_relative_eq!(*a, *b);
    }
}

fn assert_eq<T: PartialEq + Debug>(lhs: &[T], rhs: &[T]) {
    assert_eq!(lhs, rhs);
}

macro_rules! testgen_binop {
    ($test_fn: ident, $reference: expr, $($ty: ty),*) => {
        $(::paste::paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                use num_traits::NumCast;

                let lhs = $crate::tests::random(NumCast::from(8).unwrap(), NumCast::from(16).unwrap());
                let rhs = $crate::tests::random(NumCast::from(0).unwrap(), NumCast::from(8).unwrap());
                let out_ref = lhs
                    .iter()
                    .zip(rhs.iter())
                    .map(|(a, b)| $reference(a, b))
                    .collect::<Vec<_>>();
                #[cfg(x86)]
                {
                    use $crate::backend::x86::*;
                    #[cfg(fp16)]
                    if V4FP16::is_available() {
                        let out = V4FP16::run_vectorized(|| [<$test_fn _impl>]::<V4FP16, $ty>(&lhs, &rhs));
                        assert_eq!(out_ref, out);
                    }
                    #[cfg(avx512)]
                    if V4::is_available() {
                        let out = V4::run_vectorized(|| [<$test_fn _impl>]::<V4, $ty>(&lhs, &rhs));
                        assert_eq!(out_ref, out);
                    }
                    if V3::is_available() {
                        let out = V3::run_vectorized(|| [<$test_fn _impl>]::<V3, $ty>(&lhs, &rhs));
                        assert_eq!(out_ref, out);
                    }
                    if V2::is_available() {
                        let out = V2::run_vectorized(|| [<$test_fn _impl>]::<V2, $ty>(&lhs, &rhs));
                        assert_eq!(out_ref, out);
                    }
                }
                #[cfg(aarch64)]
                {
                    use $crate::backend::aarch64::NeonFma;
                    if NeonFma::is_available() {
                        let out = NeonFma::run_vectorized(|| [<$test_fn _impl>]::<NeonFma, $ty>(&lhs, &rhs));
                        assert_eq!(out_ref, out);
                    }
                }
                #[cfg(loong64)]
                {
                    use $crate::backend::loong64::*;
                    if Lasx::is_available() {
                        let out = Lasx::run_vectorized(|| [<$test_fn _impl>]::<Lasx, $ty>(&lhs, &rhs));
                        assert_eq!(&out_ref, &out);
                    }
                    if Lsx::is_available() {
                        let out = Lsx::run_vectorized(|| [<$test_fn _impl>]::<Lsx, $ty>(&lhs, &rhs));
                        assert_eq!(&out_ref, &out);
                    }
                }
                #[cfg(wasm32)]
                {
                    use crate::backend::wasm32::Simd128;
                    let out = Simd128::run_vectorized(|| [<$test_fn _impl>]::<Simd128, $ty>(&lhs, &rhs));
                    assert_eq!(&out_ref, &out);
                }
                let out = [<$test_fn _impl>]::<$crate::backend::scalar::Fallback, $ty>(&lhs, &rhs);
                assert_eq!(out_ref, out);
            }
        })*
    };
}
pub(crate) use testgen_binop;

pub(crate) trait Binop<T: Scalar> {
    fn call<S: Simd>(lhs: Vector<S, T>, rhs: Vector<S, T>) -> Vector<S, T>;
}

#[inline(always)]
fn test_binop<S: Simd, T: Scalar, Op: Binop<T>>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    let lanes = T::lanes::<S>();
    let mut output = vec![Zeroable::zeroed(); lhs.len()];
    let lhs = lhs.chunks_exact(lanes);
    let rhs = rhs.chunks_exact(lanes);
    let out = output.chunks_exact_mut(lanes);
    for ((lhs, rhs), out) in lhs.zip(rhs).zip(out) {
        let lhs = unsafe { vload_unaligned(lhs.as_ptr()) };
        let rhs = unsafe { vload_unaligned(rhs.as_ptr()) };
        unsafe { vstore_unaligned(out.as_mut_ptr(), Op::call::<S>(lhs, rhs)) };
    }
    output
}

macro_rules! binop {
    ($trait: ident, $impl: expr) => {
        ::paste::paste! {
            struct [<$trait Op>]<T>(::core::marker::PhantomData<T>);
            impl<T: $trait> $crate::tests::Binop<T> for [<$trait Op>]<T> {
                #[inline(always)]
                fn call<S: Simd>(lhs: $crate::Vector<S, T>, rhs: $crate::Vector<S, T>) -> $crate::Vector<S, T> {
                    $impl(lhs, rhs)
                }
            }
        }
    };
}
pub(crate) use binop;

pub(crate) trait Unop<T: Scalar> {
    fn call<S: Simd>(lhs: Vector<S, T>) -> Vector<S, T>;
}

#[inline(always)]
fn test_unop<S: Simd, T: Scalar, Op: Unop<T>>(a: &[T]) -> Vec<T> {
    let lanes = T::lanes::<S>();
    let mut output = vec![Zeroable::zeroed(); a.len()];
    let a = a.chunks_exact(lanes);
    let out = output.chunks_exact_mut(lanes);
    for (a, out) in a.zip(out) {
        let a = unsafe { vload_unaligned(a.as_ptr()) };
        unsafe { vstore_unaligned(out.as_mut_ptr(), Op::call::<S>(a)) };
    }
    output
}

macro_rules! unop {
    ($trait: ident, $impl: expr) => {
        ::paste::paste! {
            struct [<$trait Op>]<T>(::core::marker::PhantomData<T>);
            impl<T: $trait> Unop<T> for [<$trait Op>]<T> {
                #[inline(always)]
                fn call<S: Simd>(lhs: Vector<S, T>) -> Vector<S, T> {
                    $impl(lhs)
                }
            }
        }
    };
}
pub(crate) use unop;

macro_rules! testgen_unop {
    ($test_fn: ident, $reference: expr, $lo: expr, $hi: expr, $assert: ident, $($ty: ty),*) => {
        $(::paste::paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                use num_traits::NumCast;

                let a = $crate::tests::random::<$ty>(NumCast::from($lo).unwrap(), NumCast::from($hi).unwrap());
                let out_ref = a.iter().map(|a| $ty::$reference(*a)).collect::<Vec<_>>();
                #[cfg(x86)]
                {
                    use $crate::backend::x86::*;
                    #[cfg(fp16)]
                    if V4FP16::is_available() {
                        let out = V4FP16::run_vectorized(|| [<$test_fn _impl>]::<V4FP16, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                    #[cfg(avx512)]
                    if V4::is_available() {
                        let out = V4::run_vectorized(|| [<$test_fn _impl>]::<V4, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                    if V3::is_available() {
                        let out = V3::run_vectorized(|| [<$test_fn _impl>]::<V3, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                    if V2::is_available() {
                        let out = V2::run_vectorized(|| [<$test_fn _impl>]::<V2, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                }
                #[cfg(aarch64)]
                {
                    use $crate::backend::aarch64::NeonFma;
                    if NeonFma::is_available() {
                        let out = NeonFma::run_vectorized(|| [<$test_fn _impl>]::<NeonFma, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                }
                #[cfg(loong64)]
                {
                    use $crate::backend::loong64::*;
                    if Lasx::is_available() {
                        let out = Lasx::run_vectorized(|| [<$test_fn _impl>]::<Lasx, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                    if Lsx::is_available() {
                        let out = Lsx::run_vectorized(|| [<$test_fn _impl>]::<Lsx, $ty>(&a));
                        $assert(&out_ref, &out);
                    }
                }
                #[cfg(wasm32)]
                {
                    use crate::backend::wasm32::Simd128;
                    let out = Simd128::run_vectorized(|| [<$test_fn _impl>]::<Simd128, $ty>(&a));
                    $assert(&out_ref, &out);
                }
                let out = [<$test_fn _impl>]::<$crate::backend::scalar::Fallback, $ty>(&a);
                $assert(&out_ref, &out);
            }
        })*
    };
}
pub(crate) use testgen_unop;
