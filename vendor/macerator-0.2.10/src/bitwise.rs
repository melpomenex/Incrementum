use core::ops::{BitAnd, BitOr, BitXor, Not};

use paste::paste;

use crate::{Scalar, Simd, Vector};

macro_rules! impl_bitwise {
    ($trait: ident, $std_trait: path, $name: ident) => {
        paste!{
            pub trait $trait: Scalar + $std_trait<Output = Self> {
                fn [<$trait:lower>]<S: Simd>(lhs: Vector<S, Self>, rhs: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::$name(*lhs, *rhs))
                }
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<$name _supported>]()
                }
            }
            impl<T: $std_trait<Output = Self> + Scalar> $trait for T {}
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

impl_bitwise!(VBitAnd, BitAnd, bitand);
impl_bitwise!(VBitOr, BitOr, bitor);
impl_bitwise!(VBitXor, BitXor, bitxor);

macro_rules! impl_bitwise_unary {
    ($trait: ident, $std_trait: path, $name: ident) => {
        paste! {
            pub trait $trait: Scalar + $std_trait<Output = Self> {
                #[inline(always)]
                fn [<$trait:lower>]<S: Simd>(a: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::$name(*a))
                }
                #[inline(always)]
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<$name _supported>]()
                }
            }
            impl<T: $std_trait<Output = Self> + Scalar> $trait for T {}
            impl<S: Simd, T: $trait> $std_trait for Vector<S, T> {
                type Output = Self;

                #[inline(always)]
                fn [<$std_trait:lower>](self) -> Self::Output {
                    T::[<$trait:lower>](self)
                }
            }
        }
    };
}

impl_bitwise_unary!(VBitNot, Not, bitnot);
