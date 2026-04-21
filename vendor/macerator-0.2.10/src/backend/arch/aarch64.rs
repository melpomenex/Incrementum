use crate::{
    Simd,
    backend::{aarch64::NeonFma, scalar::Fallback},
};

use super::WithSimd;

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
#[repr(u8)]
pub enum Arch {
    Scalar,
    NeonFma,
}

impl Arch {
    pub fn new() -> Self {
        if NeonFma::is_available() {
            Self::NeonFma
        } else {
            Self::Scalar
        }
    }

    pub fn dispatch<Op: WithSimd>(self, op: Op) -> Op::Output {
        match self {
            Arch::Scalar => <Fallback as Simd>::vectorize(op),
            Arch::NeonFma => <NeonFma as Simd>::vectorize(op),
        }
    }
}

impl Default for Arch {
    fn default() -> Self {
        Self::new()
    }
}
