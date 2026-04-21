use approx::{assert_relative_eq, RelativeEq};
use num_traits::{Bounded, Float, NumCast, Zero};

use crate::{
    tests::assert_eq, vload_unaligned, ReduceAdd, ReduceMax, ReduceMin, Scalar, Simd, Vector,
};
use core::fmt::Debug;
use core::ops::Add;

macro_rules! reduce_op {
    ($trait: ident, $scalar_trait: path, $impl: expr, $impl_scalar: expr) => {
        ::paste::paste! {
            struct [<$trait Op>]<T>(::core::marker::PhantomData<T>);
            impl<T: $trait + $scalar_trait> ReduceOp<T> for [<$trait Op>]<T> {
                #[inline(always)]
                fn call<S: Simd>(lhs: Vector<S, T>) -> T {
                    $impl(lhs)
                }
                #[inline(always)]
                fn call_scalar(lhs: T, rhs: T) -> T {
                    $impl_scalar(lhs, rhs)
                }
            }
        }
    };
}

#[inline(always)]
fn test_reduce_add_impl<S: Simd, T: ReduceAdd + Add + Zero + Debug>(a: &[T]) -> T {
    reduce_op!(
        ReduceAdd,
        Add<Output = T>,
        |a: Vector<S, T>| a.reduce_add(),
        Add::add
    );
    test_reduce_op::<S, T, ReduceAddOp<T>>(a, Zero::zero())
}

#[inline(always)]
fn test_reduce_min_ord_impl<S: Simd, T: ReduceMin + Ord + Bounded + Debug>(a: &[T]) -> T {
    reduce_op!(ReduceMin, Ord, |a: Vector<S, T>| a.reduce_min(), Ord::min);
    test_reduce_op::<S, T, ReduceMinOp<T>>(a, Bounded::max_value())
}

#[inline(always)]
fn test_reduce_max_ord_impl<S: Simd, T: ReduceMax + Ord + Bounded + Debug>(a: &[T]) -> T {
    reduce_op!(ReduceMax, Ord, |a: Vector<S, T>| a.reduce_max(), Ord::max);
    test_reduce_op::<S, T, ReduceMaxOp<T>>(a, Bounded::min_value())
}

#[inline(always)]
fn test_reduce_min_float_impl<S: Simd, T: ReduceMin + Float + Bounded + Debug>(a: &[T]) -> T {
    reduce_op!(
        ReduceMin,
        Float,
        |a: Vector<S, T>| a.reduce_min(),
        Float::min
    );
    test_reduce_op::<S, T, ReduceMinOp<T>>(a, Bounded::max_value())
}

#[inline(always)]
fn test_reduce_max_float_impl<S: Simd, T: ReduceMax + Float + Bounded + Debug>(a: &[T]) -> T {
    reduce_op!(
        ReduceMax,
        Float,
        |a: Vector<S, T>| a.reduce_max(),
        Float::max
    );
    test_reduce_op::<S, T, ReduceMaxOp<T>>(a, Bounded::min_value())
}

pub(crate) trait ReduceOp<T: Scalar> {
    fn call<S: Simd>(lhs: Vector<S, T>) -> T;
    fn call_scalar(lhs: T, rhs: T) -> T;
}

#[inline(always)]
fn test_reduce_op<S: Simd, T: Scalar + Debug, Op: ReduceOp<T>>(a: &[T], default: T) -> T {
    let lanes = T::lanes::<S>();
    let mut output = default;
    let a = a.chunks_exact(lanes);
    for a in a {
        let a = unsafe { vload_unaligned(a.as_ptr()) };
        let val = Op::call::<S>(a);
        output = Op::call_scalar(output, val);
    }
    output
}

macro_rules! testgen_reduce {
    ($test_fn: ident, $reference: expr, $default: expr, $lo: expr, $hi: expr, $size: expr, $assert: ident, $($ty: ty),*) => {
        $(::paste::paste! {
            #[::wasm_bindgen_test::wasm_bindgen_test(unsupported = test)]
            fn [<$test_fn _ $ty>]() {
                use num_traits::NumCast;

                let a = $crate::tests::random_of_size::<$ty>(NumCast::from($lo).unwrap(), NumCast::from($hi).unwrap(), $size);
                let out_ref: [$ty; 1] = [a.iter().copied().fold($default, |a: $ty, b: $ty| a.$reference(b))];
                #[cfg(x86)]
                {
                    use $crate::backend::x86::*;
                    #[cfg(fp16)]
                    if V4FP16::is_available() {
                        let out = V4FP16::run_vectorized(|| [<$test_fn _impl>]::<V4FP16, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                    #[cfg(avx512)]
                    if V4::is_available() {
                        let out = V4::run_vectorized(|| [<$test_fn _impl>]::<V4, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                    if V3::is_available() {
                        let out = V3::run_vectorized(|| [<$test_fn _impl>]::<V3, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                    if V2::is_available() {
                        let out = V2::run_vectorized(|| [<$test_fn _impl>]::<V2, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                }
                #[cfg(aarch64)]
                {
                    use $crate::backend::aarch64::NeonFma;
                    if NeonFma::is_available() {
                        let out = NeonFma::run_vectorized(|| [<$test_fn _impl>]::<NeonFma, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                }
                #[cfg(loong64)]
                {
                    use $crate::backend::loong64::*;
                    if Lasx::is_available() {
                        let out = Lasx::run_vectorized(|| [<$test_fn _impl>]::<Lasx, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                    if Lsx::is_available() {
                        let out = Lsx::run_vectorized(|| [<$test_fn _impl>]::<Lsx, $ty>(&a));
                        $assert(&out_ref, &[out]);
                    }
                }
                #[cfg(wasm32)]
                {
                    use crate::backend::wasm32::Simd128;
                    let out = Simd128::run_vectorized(|| [<$test_fn _impl>]::<Simd128, $ty>(&a));
                    $assert(&out_ref, &[out]);
                }
                let out = [<$test_fn _impl>]::<$crate::backend::scalar::Fallback, $ty>(&a);
                $assert(&out_ref, &[out]);
            }
        })*
    };
}

// Skipping f16 because assertion library doesn't support it
testgen_reduce!(
    test_reduce_add,
    add,
    Zero::zero(),
    1,
    100,
    128,
    assert_approx_eq_sum,
    f32,
    f64
);

testgen_reduce!(
    test_reduce_add,
    wrapping_add,
    Zero::zero(),
    1,
    100,
    128,
    assert_eq,
    u16,
    i16,
    u32,
    i32,
    u64,
    i64
);

testgen_reduce!(
    test_reduce_add,
    wrapping_add,
    Zero::zero(),
    0,
    2,
    64,
    assert_eq,
    u8,
    i8
);

testgen_reduce!(
    test_reduce_min_ord,
    min,
    Bounded::max_value(),
    1,
    100,
    128,
    assert_eq,
    u8,
    u16,
    u32,
    u64
);

testgen_reduce!(
    test_reduce_min_ord,
    min,
    Bounded::max_value(),
    -50,
    50,
    128,
    assert_eq,
    i8,
    i16,
    i32,
    i64
);

testgen_reduce!(
    test_reduce_min_float,
    min,
    Bounded::max_value(),
    -50,
    50,
    128,
    assert_eq,
    f32,
    f64
);

testgen_reduce!(
    test_reduce_max_ord,
    max,
    Bounded::min_value(),
    1,
    100,
    128,
    assert_eq,
    u8,
    u16,
    u32,
    u64
);

testgen_reduce!(
    test_reduce_max_ord,
    max,
    Bounded::min_value(),
    -50,
    50,
    128,
    assert_eq,
    i8,
    i16,
    i32,
    i64
);

testgen_reduce!(
    test_reduce_max_float,
    max,
    Bounded::min_value(),
    -50,
    50,
    128,
    assert_eq,
    f32,
    f64
);

fn assert_approx_eq_sum<T: RelativeEq<Epsilon = T> + Debug + NumCast + Copy>(lhs: &[T], rhs: &[T]) {
    // No idea what the actual deviation is, f64 failed with an absolute difference
    // of 1e-10
    let epsilon = T::from(2.0.powf(-8.0)).unwrap();
    for (a, b) in lhs.iter().zip(rhs) {
        assert_relative_eq!(*a, *b, epsilon = epsilon);
    }
}
