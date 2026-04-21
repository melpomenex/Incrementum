use crate::{
    tests::{binop, test_binop},
    vload_unaligned, Scalar, Simd, VEq, VOrd, Vector,
};

pub(crate) trait CmpOp<T: Scalar> {
    fn call<S: Simd>(lhs: Vector<S, T>, rhs: Vector<S, T>) -> T::Mask<S>;
}

#[inline(always)]
fn test_cmp<S: Simd, T: Scalar, Op: CmpOp<T>>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    let lanes = T::lanes::<S>();
    let mut output = vec![false; lhs.len()];
    let lhs = lhs.chunks_exact(lanes);
    let rhs = rhs.chunks_exact(lanes);
    let out = output.chunks_exact_mut(lanes);
    for ((lhs, rhs), out) in lhs.zip(rhs).zip(out) {
        let lhs = unsafe { vload_unaligned(lhs.as_ptr()) };
        let rhs = unsafe { vload_unaligned(rhs.as_ptr()) };

        unsafe { T::mask_store_as_bool(out.as_mut_ptr(), Op::call::<S>(lhs, rhs)) };
    }
    output
}

macro_rules! cmp_op {
    ($trait: ident, $impl: expr) => {
        ::paste::paste! {
            struct [<$trait Op>]<T>(::core::marker::PhantomData<T>);
            impl<T: $trait> CmpOp<T> for [<$trait Op>]<T> {
                #[inline(always)]
                fn call<S: Simd>(lhs: $crate::Vector<S, T>, rhs: $crate::Vector<S, T>) -> T::Mask<S> {
                    $impl(lhs, rhs)
                }
            }
        }
    };
}

macro_rules! testgen_cmp {
    ($test_fn: ident, $reference: expr, $($ty: ty),*) => {
        $(::paste::paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                use num_traits::NumCast;

                let lhs = $crate::tests::random(NumCast::from(0).unwrap(), NumCast::from(127).unwrap());
                let rhs = $crate::tests::random(NumCast::from(0).unwrap(), NumCast::from(127).unwrap());
                let out_ref = lhs
                    .iter()
                    .zip(rhs.iter())
                    .map(|(a, b)| $ty::$reference(a, b))
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

macro_rules! testgen_min_max {
    ($test_fn: ident, $reference: expr, $($ty: ty),*) => {
        $(::paste::paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                use num_traits::NumCast;

                let lhs = $crate::tests::random(NumCast::from(0).unwrap(), NumCast::from(127).unwrap());
                let rhs = $crate::tests::random(NumCast::from(0).unwrap(), NumCast::from(127).unwrap());
                let out_ref = lhs
                    .iter()
                    .zip(rhs.iter())
                    .map(|(a, b)| $ty::$reference(*a, *b))
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

#[inline(always)]
fn test_eq_impl<S: Simd, T: VEq>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    cmp_op!(VEq, |a: Vector<S, T>, b| a.eq(b));
    test_cmp::<S, T, VEqOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_lt_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    cmp_op!(VOrd, |a: Vector<S, T>, b| a.lt(b));
    test_cmp::<S, T, VOrdOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_le_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    cmp_op!(VOrd, |a: Vector<S, T>, b| a.le(b));
    test_cmp::<S, T, VOrdOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_gt_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    cmp_op!(VOrd, |a: Vector<S, T>, b| a.gt(b));
    test_cmp::<S, T, VOrdOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_ge_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<bool> {
    cmp_op!(VOrd, |a: Vector<S, T>, b| a.ge(b));
    test_cmp::<S, T, VOrdOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_min_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VOrd, |a: Vector<S, T>, b| a.min(b));
    test_binop::<S, T, VOrdOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_max_impl<S: Simd, T: VOrd>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VOrd, |a: Vector<S, T>, b| a.max(b));
    test_binop::<S, T, VOrdOp<T>>(lhs, rhs)
}

testgen_cmp!(test_eq, eq, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_cmp!(test_lt, lt, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_cmp!(test_gt, gt, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_cmp!(test_le, le, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_cmp!(test_ge, ge, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_min_max!(test_min, min, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
testgen_min_max!(test_max, max, u8, i8, u16, i16, u32, i32, f32, u64, i64, f64);
