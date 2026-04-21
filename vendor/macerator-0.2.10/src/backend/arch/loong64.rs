use crate::{
    backend::{
        loong64::{Lasx, Lsx},
        scalar::Fallback,
    },
    Simd,
};

use super::WithSimd;

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
#[repr(u8)]
pub enum Arch {
    Scalar,
    Lsx,
    Lasx,
}

impl Arch {
    pub fn new() -> Self {
        if Lasx::is_available() {
            Self::Lasx
        } else if Lsx::is_available() {
            Self::Lsx
        } else {
            Self::Scalar
        }
    }

    pub fn dispatch<Op: WithSimd>(self, op: Op) -> Op::Output {
        match self {
            Arch::Scalar => <Fallback as Simd>::vectorize(op),
            Arch::Lsx => <Lsx as Simd>::vectorize(op),
            Arch::Lasx => <Lasx as Simd>::vectorize(op),
        }
    }
}

impl Default for Arch {
    fn default() -> Self {
        Self::new()
    }
}
