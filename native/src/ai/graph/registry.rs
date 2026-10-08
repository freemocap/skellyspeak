use super::{model::fault, *};
use std::{collections::BTreeMap, future::Future, pin::Pin, sync::Arc};

pub type Handler =
    Arc<dyn Fn(Values) -> Pin<Box<dyn Future<Output = Result<Values>> + Send>> + Send + Sync>;

#[derive(Default)]
pub struct Registry {
    pub(super) types: BTreeMap<Contract, Shape>,
    pub(super) operations: BTreeMap<Contract, (Operation, Handler)>,
}
impl Registry {
    pub fn define_type(&mut self, contract: Contract, shape: Shape) -> Result<()> {
        valid_contract(&contract)?;
        if self.types.contains_key(&contract) {
            return Err(fault("duplicate_type", &contract.name));
        }
        self.types.insert(contract, shape);
        Ok(())
    }
    pub fn register(&mut self, operation: Operation, handler: Handler) -> Result<()> {
        valid_contract(&operation.contract)?;
        valid_name(&operation.implementation)?;
        if self.operations.contains_key(&operation.contract) {
            return Err(fault("duplicate_operation", &operation.contract.name));
        }
        for (name, port) in operation.inputs.iter().chain(&operation.outputs) {
            valid_name(name)?;
            if !self.types.contains_key(&port.contract) {
                return Err(fault("unknown_type", name));
            }
        }
        self.operations
            .insert(operation.contract.clone(), (operation, handler));
        Ok(())
    }
}
pub(super) fn valid_name(name: &str) -> Result<()> {
    if name.is_empty() || name.len() > 160 || name.chars().any(char::is_control) {
        // Do not echo arbitrary rejected identifiers into diagnostics.
        return Err(fault("invalid_identifier", "identifier"));
    }
    Ok(())
}
pub(super) fn valid_contract(contract: &Contract) -> Result<()> {
    valid_name(&contract.name)?;
    if contract.version == 0 {
        return Err(fault("invalid_version", &contract.name));
    }
    Ok(())
}
