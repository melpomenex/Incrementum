use half::f16;
use paste::paste;

use crate::{Scalar, Simd, Vector};

pub trait VEq: Scalar + PartialEq {
    /// Compare two vectors for elementwise equality
    fn veq<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S>;
    fn is_accelerated<S: Simd>() -> bool;
}

macro_rules! impl_veq {
    ($($ty: ty),*) => {
        $(paste! {
            impl VEq for $ty {
                #[inline(always)]
                fn veq<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S> {
                    S::[<equals_ $ty>](*a, *b)
                }
                #[inline(always)]
                fn is_accelerated<S: Simd>() -> bool {
                    S::[<equals_ $ty _supported>]()
                }
            }
        })*
    };
}

impl<S: Simd, T: VEq> Vector<S, T> {
    #[inline(always)]
    pub fn eq(self, other: Self) -> T::Mask<S> {
        T::veq(self, other)
    }
}

impl_veq!(u8, i8, u16, f16, i16, u32, i32, f32, u64, i64, f64);

pub trait VOrd: VEq {
    /// Apply elementwise [`PartialOrd::lt`] on two vectors
    fn vlt<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S>;
    /// Apply elementwise [`PartialOrd::le`] on two vectors
    fn vle<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S>;
    /// Apply elementwise [`PartialOrd::gt`] on two vectors
    fn vgt<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S>;
    /// Apply elementwise [`PartialOrd::ge`] on two vectors
    fn vge<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S>;
    /// Apply elementwise [`Ord::min`] to two vectors
    fn vmin<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Vector<S, Self>;
    /// Apply elementwise [`Ord::max`] on two vectors
    fn vmax<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Vector<S, Self>;
    fn is_cmp_accelerated<S: Simd>() -> bool;
    fn is_min_max_accelerated<S: Simd>() -> bool;
}

impl<S: Simd, T: VOrd> Vector<S, T> {
    /// Apply elementwise [`PartialOrd::lt`] on two vectors
    #[inline(always)]
    pub fn lt(self, b: Self) -> T::Mask<S> {
        T::vlt(self, b)
    }
    /// Apply elementwise [`PartialOrd::le`] on two vectors
    #[inline(always)]
    pub fn le(self, b: Self) -> T::Mask<S> {
        T::vle(self, b)
    }
    /// Apply elementwise [`PartialOrd::gt`] on two vectors
    #[inline(always)]
    pub fn gt(self, b: Self) -> T::Mask<S> {
        T::vgt(self, b)
    }
    /// Apply elementwise [`PartialOrd::ge`] on two vectors
    #[inline(always)]
    pub fn ge(self, b: Self) -> T::Mask<S> {
        T::vge(self, b)
    }
    /// Apply elementwise [`Ord::min`] to two vectors
    #[inline(always)]
    pub fn min(self, b: Self) -> Self {
        T::vmin(self, b)
    }
    /// Apply elementwise [`Ord::max`] on two vectors
    #[inline(always)]
    pub fn max(self, b: Self) -> Self {
        T::vmax(self, b)
    }
}

macro_rules! impl_vord {
    ($($ty: ty),*) => {
        $(paste! {
            impl VOrd for $ty {
                #[inline(always)]
                fn vlt<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S> {
                    S::[<less_than_ $ty>](*a, *b)
                }
                #[inline(always)]
                fn vle<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S> {
                    S::[<less_than_or_equal_ $ty>](*a, *b)
                }
                #[inline(always)]
                fn vgt<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S> {
                    S::[<greater_than_ $ty>](*a, *b)
                }
                #[inline(always)]
                fn vge<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Self::Mask<S> {
                    S::[<greater_than_or_equal_ $ty>](*a, *b)
                }
                #[inline(always)]
                fn vmin<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::[<min_ $ty>](*a, *b))
                }
                #[inline(always)]
                fn vmax<S: Simd>(a: Vector<S, Self>, b: Vector<S, Self>) -> Vector<S, Self> {
                    S::typed(S::[<max_ $ty>](*a, *b))
                }
                #[inline(always)]
                fn is_cmp_accelerated<S: Simd>() -> bool {
                    S::[<less_than_ $ty _supported>]()
                }
                #[inline(always)]
                fn is_min_max_accelerated<S: Simd>() -> bool {
                    S::[<min_ $ty _supported>]()
                }
            }
        })*
    };
}

impl_vord!(u8, i8, u16, i16, f16, u32, i32, f32, u64, i64, f64);
