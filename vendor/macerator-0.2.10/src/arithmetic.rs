use core::ops::{Add, Div, Mul, Sub};

use half::f16;
use paste::paste;

use crate::{
    backend::{Simd, Vector},
    Scalar,
};

macro_rules! impl_arith {
    ($trait: ident, $std_trait: path, $name: ident, $($ty: ty),*) => {
        paste!{
            pub trait $trait: Scalar + $std_trait<Output = Self> {
                fn [<$trait:lower>]<S: Simd>(lhs: Vector<S, Self>, rhs: Vector<S, Self>) -> Vector<S, Self>;
                fn is_accelerated<S: Simd>() -> bool;
            }
            $(impl $trait for $ty {
                #[inline(always)]
                fn [<$trait:lower>]<S: Simd>(lhs: Vector<S, Self>, rhs: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::[<$name _ $ty>](*lhs, *rhs))
                }
                #[inline(always)]
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<$name _ $ty _supported>]()
                }
            })*
            impl<S: Simd, T: $trait> $std_trait<Self> for Vector<S, T> {
                type Output = Self;

                #[inline(always)]
                fn $name(self, rhs: Self) -> Self::Output {
                    T::[<$trait:lower>](self, rhs)
                }
            }
            impl<S: Simd, T: $trait> ::core::ops::[<$std_trait Assign>]<Self> for Vector<S, T> {
                #[inline(always)]
                fn [<$name _assign>](&mut self, rhs: Self) {
                    *self = T::[<$trait:lower>](*self, rhs)
                }
            }
        }
    };
}

impl_arith!(VAdd, Add, add, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
impl_arith!(VSub, Sub, sub, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
impl_arith!(VDiv, Div, div, f16, f32, f64);
impl_arith!(VMul, Mul, mul, u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);

pub trait VMulAdd: Scalar + Mul<Output = Self> + Add<Output = Self> {
    fn vmul_add<S: Simd>(
        a: Vector<S, Self>,
        b: Vector<S, Self>,
        c: Vector<S, Self>,
    ) -> Vector<S, Self>;
    fn is_accelerated<S: Simd>() -> bool;
}

impl<S: Simd, T: VMulAdd> Vector<S, T> {
    #[inline(always)]
    pub fn mul_add(self, b: Self, c: Self) -> Self {
        T::vmul_add(self, b, c)
    }
}

macro_rules! impl_mul_add {
    (fallback $($ty: ty),*) => {
        paste!{
            $(impl VMulAdd for $ty {
                #[inline(always)]
                fn vmul_add<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>, c: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::[<add_ $ty>](S::[<mul_ $ty>](*a, *b), *c))
                }
                #[inline(always)]
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<mul_ $ty _supported>]() && S::[<add_ $ty _supported>]()
                }
            })*
        }
    };
    (intrinsic $($ty: ty),*) => {
        paste!{
            $(impl VMulAdd for $ty {
                #[inline(always)]
                fn vmul_add<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>, c: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::[<mul_add_ $ty>](*a, *b, *c))
                }
                #[inline(always)]
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<mul_add_ $ty _supported>]()
                }
            })*
        }
    };
}

impl_mul_add!(intrinsic f16, f32, f64);
impl_mul_add!(fallback u8, i8, u16, i16, u32, i32, u64, i64);
