use core::fmt::Debug;

use approx::{assert_relative_eq, RelativeEq};
use num_traits::{Float, NumCast};

use crate::{
    tests::{assert_eq, test_unop, unop},
    Simd, VAbs, VRecip, Vector,
};

use super::{testgen_unop, Unop};

#[inline(always)]
fn test_recip_impl<S: Simd, T: VRecip>(a: &[T]) -> Vec<T> {
    unop!(VRecip, |a: Vector<S, T>| a.recip());
    test_unop::<S, T, VRecipOp<T>>(a)
}

#[inline(always)]
fn test_abs_impl<S: Simd, T: VAbs>(a: &[T]) -> Vec<T> {
    unop!(VAbs, |a: Vector<S, T>| a.abs());
    test_unop::<S, T, VAbsOp<T>>(a)
}

fn assert_approx_eq_recip<T: RelativeEq<Epsilon = T> + Debug + NumCast + Copy>(
    lhs: &[T],
    rhs: &[T],
) {
    // Generous epsilon, intel specifies `1.5 * 2^-12`, but ARM doesn't have any
    // spec.
    let epsilon = T::from(2.0.powf(-8.0)).unwrap();
    for (a, b) in lhs.iter().zip(rhs) {
        assert_relative_eq!(*a, *b, epsilon = epsilon);
    }
}

testgen_unop!(test_recip, recip, 1, 100, assert_approx_eq_recip, f32, f64);
testgen_unop!(test_abs, abs, -100, 100, assert_eq, i8, i16, i32, f32, f64);
