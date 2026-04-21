use core::ops::Not;

use crate::{Simd, VBitAnd, VBitNot, VBitOr, VBitXor};

use super::*;

#[inline(always)]
fn test_bitand_impl<S: Simd, T: VBitAnd>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VBitAnd, |a, b| a & b);
    test_binop::<S, T, VBitAndOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_bitor_impl<S: Simd, T: VBitOr>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VBitOr, |a, b| a | b);
    test_binop::<S, T, VBitOrOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_bitxor_impl<S: Simd, T: VBitXor>(lhs: &[T], rhs: &[T]) -> Vec<T> {
    binop!(VBitXor, |a, b| a ^ b);
    test_binop::<S, T, VBitXorOp<T>>(lhs, rhs)
}

#[inline(always)]
fn test_not_impl<S: Simd, T: VBitNot>(a: &[T]) -> Vec<T> {
    unop!(VBitNot, |a: Vector<S, T>| a.not());
    test_unop::<S, T, VBitNotOp<T>>(a)
}

testgen_binop!(
    test_bitand,
    |a, b| a & b,
    u8,
    i8,
    u16,
    i16,
    u32,
    i32,
    u64,
    i64
);
testgen_binop!(
    test_bitor,
    |a, b| a | b,
    u8,
    i8,
    u16,
    i16,
    u32,
    i32,
    u64,
    i64
);
testgen_binop!(
    test_bitxor,
    |a, b| a ^ b,
    u8,
    i8,
    u16,
    i16,
    u32,
    i32,
    u64,
    i64
);

testgen_unop!(test_not, not, 0, 100, assert_eq, u8, i8, u16, i16, u32, i32, u64, i64);
