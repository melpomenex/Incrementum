use crate::scalar::Fallback;

use bytemuck::Zeroable;
use half::f16;
use num_traits::NumCast;
use paste::paste;

use crate::{vload_unaligned, vstore_unaligned, Simd, VAdd, VDiv, VMul, VMulAdd, VSub};

use super::{assert_approx_eq, binop, test_binop, testgen_binop};

#[inline(always)]
fn test_add_impl<S: Simd, T: VAdd>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VAdd, |a, b| a + b);
    test_binop::<S, T, VAddOp<T>>(lhs, rhs)
}
#[inline(always)]
fn test_sub_impl<S: Simd, T: VSub>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VSub, |a, b| a - b);
    test_binop::<S, T, VSubOp<T>>(lhs, rhs)
}
#[inline(always)]
fn test_mul_impl<S: Simd, T: VMul>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VMul, |a, b| a * b);
    test_binop::<S, T, VMulOp<T>>(lhs, rhs)
}
#[inline(always)]
fn test_div_impl<S: Simd, T: VDiv>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VDiv, |a, b| a / b);
    test_binop::<S, T, VDivOp<T>>(lhs, rhs)
}
#[inline(always)]
fn test_fma_impl<S: Simd, T: VMulAdd>(a: &[T], b: &[T], c: &[T]) -> Vec<T> {
    let lanes = T::lanes::<S>();
    let mut output = vec![Zeroable::zeroed(); a.len()];
    let a = a.chunks_exact(lanes);
    let b = b.chunks_exact(lanes);
    let c = c.chunks_exact(lanes);
    let out = output.chunks_exact_mut(lanes);
    for (((a, b), c), out) in a.zip(b).zip(c).zip(out) {
        let a = unsafe { vload_unaligned::<S, _>(a.as_ptr()) };
        let b = unsafe { vload_unaligned(b.as_ptr()) };
        let c = unsafe { vload_unaligned(c.as_ptr()) };
        unsafe { vstore_unaligned(out.as_mut_ptr(), a.mul_add(b, c)) };
    }
    output
}

testgen_binop!(
    test_add,
    |a, b| a + b,
    u8,
    i8,
    u16,
    i16,
    f16,
    u32,
    i32,
    f32,
    u64,
    i64,
    f64
);

testgen_binop!(
    test_sub,
    |a, b| a - b,
    u8,
    i8,
    u16,
    i16,
    f16,
    u32,
    i32,
    f32,
    u64,
    i64,
    f64
);
testgen_binop!(test_div, |a, b| a / b, f16, f32, f64);
testgen_binop!(
    test_mul,
    |a, b| a * b,
    u8,
    i8,
    u16,
    i16,
    f16,
    u32,
    i32,
    f32,
    f64
);

macro_rules! testgen_fma {
    ($test_fn: ident, $($ty: ty),*) => {
        $(paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                let a = super::random(NumCast::from(0).unwrap(), NumCast::from(8).unwrap());
                let b = super::random(NumCast::from(0).unwrap(), NumCast::from(8).unwrap());
                let c = super::random(NumCast::from(0).unwrap(), NumCast::from(64).unwrap());
                let out_ref = a
                    .iter()
                    .zip(b.iter()).zip(c.iter())
                    .map(|((a, b), c)| a * b + c)
                    .collect::<Vec<_>>();
                #[cfg(x86)]
                {
                    use crate::backend::x86::*;
                    #[cfg(fp16)]
                    if V4FP16::is_available() {
                        let out = V4FP16::run_vectorized(|| [<$test_fn _impl>]::<V4FP16, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                    #[cfg(avx512)]
                    if V4::is_available() {
                        let out = V4::run_vectorized(|| [<$test_fn _impl>]::<V4, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                    if V3::is_available() {
                        let out = V3::run_vectorized(|| [<$test_fn _impl>]::<V3, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                    if V2::is_available() {
                        let out = V2::run_vectorized(|| [<$test_fn _impl>]::<V2, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                }
                #[cfg(aarch64)]
                {
                    use crate::backend::aarch64::NeonFma;
                    if NeonFma::is_available() {
                        let out = NeonFma::run_vectorized(|| [<$test_fn _impl>]::<NeonFma, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                }
                #[cfg(loong64)]
                {
                    use crate::backend::loong64::*;
                    if Lasx::is_available() {
                        let out = Lasx::run_vectorized(|| [<$test_fn _impl>]::<Lasx, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                    if Lsx::is_available() {
                        let out = Lsx::run_vectorized(|| [<$test_fn _impl>]::<Lsx, $ty>(&a, &b, &c));
                        assert_approx_eq(&out_ref, &out);
                    }
                }
                #[cfg(wasm32)]
                {
                    use crate::backend::wasm32::Simd128;
                    let out = Simd128::run_vectorized(|| [<$test_fn _impl>]::<Simd128, $ty>(&a, &b, &c));
                    assert_approx_eq(&out_ref, &out);
                }
                let out = [<$test_fn _impl>]::<Fallback, $ty>(&a, &b, &c);
                assert_approx_eq(&out_ref, &out);
            }
        })*
    };
}

testgen_fma!(test_fma, f32, f64);
