use super::{
    model::fault,
    registry::{valid_contract, valid_name},
    *,
};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub struct Executable {
    pub(super) artifact: Artifact,
    pub(super) source: Definition,
    pub(super) handlers: BTreeMap<Contract, Handler>,
    pub(super) identity: String,
    pub(super) order: Vec<String>,
}
impl Registry {
    pub fn compile(&self, definition: Definition) -> Result<Executable> {
        self.compile_at(definition, 0)
    }
    pub(super) fn compile_at(
        &self,
        mut definition: Definition,
        depth: usize,
    ) -> Result<Executable> {
        let source = definition.clone();
        self.expand(&mut definition, depth)?;
        valid_contract(&definition.contract)?;
        if definition.nodes.len() > 1024 {
            return Err(fault(CoreFaultCode::GraphLimit, "nodes"));
        }
        let mut operations = BTreeMap::new();
        let mut handlers = BTreeMap::new();
        for (id, node) in &definition.nodes {
            valid_name(id)?;
            let (op, handler) = self
                .operations
                .get(&node.operation)
                .ok_or_else(|| fault(CoreFaultCode::UnknownOperation, id))?;
            operations.insert(node.operation.clone(), op.clone());
            handlers.insert(node.operation.clone(), handler.clone());
        }
        let mut types = BTreeMap::new();
        for (name, port) in definition
            .inputs
            .iter()
            .chain(&definition.outputs)
            .chain(
                definition
                    .compositions
                    .values()
                    .flat_map(|b| b.source.inputs.iter().chain(&b.source.outputs)),
            )
            .chain(
                operations
                    .values()
                    .flat_map(|op| op.inputs.iter().chain(&op.outputs)),
            )
        {
            valid_name(name)?;
            let shape = self
                .types
                .get(&port.contract)
                .ok_or_else(|| fault(CoreFaultCode::UnknownType, name))?;
            types.insert(port.contract.clone(), shape.clone());
        }
        // Source constants and guards may use types absent from operation ports.
        for source in definition
            .nodes
            .values()
            .flat_map(|n| n.inputs.values().chain(n.guard.iter()))
            .chain(definition.results.values())
            .chain(
                definition
                    .compositions
                    .values()
                    .flat_map(|b| b.bindings.values()),
            )
        {
            if let Source::Constant { contract, .. } | Source::Absent(contract) = source {
                let shape = self
                    .types
                    .get(contract)
                    .ok_or_else(|| fault(CoreFaultCode::UnknownType, "source"))?;
                types.insert(contract.clone(), shape.clone());
            }
        }
        let artifact = Artifact {
            definition,
            operations,
            types,
        };
        let mut graph = Executable {
            artifact,
            source,
            handlers,
            identity: String::new(),
            order: Vec::new(),
        };
        graph.order = graph.validate()?;
        graph.identity = graph.fingerprint()?;
        Ok(graph)
    }
}
impl Executable {
    pub fn artifact(&self) -> &Artifact {
        &self.artifact
    }
    pub fn identity(&self) -> &str {
        &self.identity
    }
    fn fingerprint(&self) -> Result<String> {
        // Sorted registries retain exact identity independent of registration order.
        digest(&(
            &self.artifact.definition,
            self.artifact.operations.iter().collect::<Vec<_>>(),
            self.artifact.types.iter().collect::<Vec<_>>(),
        ))
    }
    pub(super) fn operation(&self, node: &str) -> &Operation {
        &self.artifact.operations[&self.artifact.definition.nodes[node].operation]
    }
    pub(super) fn values(&self, ports: &Ports, values: &Values) -> Result<()> {
        if values.keys().any(|k| !ports.contains_key(k)) {
            return Err(fault(CoreFaultCode::UnexpectedPort, "values"));
        }
        for (name, port) in ports {
            match values.get(name) {
                None if port.optional => (),
                Some(value) if self.artifact.types[&port.contract].accepts(value) => (),
                _ => return Err(fault(CoreFaultCode::InvalidValue, name)),
            }
        }
        Ok(())
    }
    pub(super) fn source_port(&self, source: &Source) -> Result<Port> {
        let d = &self.artifact.definition;
        match source {
            Source::Input(name) => d
                .inputs
                .get(name)
                .cloned()
                .ok_or_else(|| fault(CoreFaultCode::UnknownInput, name)),
            Source::Output { node, port } => {
                let n = d
                    .nodes
                    .get(node)
                    .ok_or_else(|| fault(CoreFaultCode::UnknownNode, node))?;
                let mut p = self.artifact.operations[&n.operation]
                    .outputs
                    .get(port)
                    .cloned()
                    .ok_or_else(|| fault(CoreFaultCode::UnknownOutput, port))?;
                p.optional |= n.guard.is_some() || n.activation == Activation::Disabled;
                Ok(p)
            }
            Source::Absent(contract) => Ok(Port {
                contract: contract.clone(),
                optional: true,
            }),
            Source::Constant { contract, value } => {
                if !self.artifact.types[contract].accepts(value) {
                    return Err(fault(CoreFaultCode::InvalidConstant, "constant"));
                }
                Ok(Port {
                    contract: contract.clone(),
                    optional: false,
                })
            }
        }
    }
    fn bindings(&self, ports: &Ports, bindings: &BTreeMap<String, Source>) -> Result<()> {
        if ports.keys().ne(bindings.keys()) {
            return Err(fault(CoreFaultCode::BindingSet, "ports"));
        }
        for (name, target) in ports {
            let source = self.source_port(&bindings[name])?;
            if source.contract != target.contract || (source.optional && !target.optional) {
                return Err(fault(CoreFaultCode::IncompatiblePort, name));
            }
        }
        Ok(())
    }
    fn validate(&self) -> Result<Vec<String>> {
        let d = &self.artifact.definition;
        self.bindings(&d.outputs, &d.results)?;
        for boundary in d.compositions.values() {
            self.bindings(&boundary.source.inputs, &boundary.bindings)?;
        }
        for (id, node) in &d.nodes {
            self.bindings(&self.operation(id).inputs, &node.inputs)?;
            let mut seen = BTreeSet::new();
            for parent in &node.after {
                if !d.nodes.contains_key(parent) {
                    return Err(fault(CoreFaultCode::UnknownControlParent, id));
                }
                if !seen.insert(parent) {
                    return Err(fault(CoreFaultCode::DuplicateControl, id));
                }
            }
            if let Some(guard) = &node.guard {
                let port = self.source_port(guard)?;
                if port.optional || self.artifact.types[&port.contract] != Shape::Boolean {
                    return Err(fault(CoreFaultCode::InvalidGuard, id));
                }
            }
        }
        let mut complete = BTreeSet::new();
        let mut order = Vec::new();
        while complete.len() < d.nodes.len() {
            let before = complete.len();
            for (id, node) in &d.nodes {
                if complete.contains(id) {
                    continue;
                }
                let data = node
                    .inputs
                    .values()
                    .chain(node.guard.iter())
                    .filter_map(|s| match s {
                        Source::Output { node, .. } => Some(node),
                        _ => None,
                    });
                if node.after.iter().chain(data).all(|p| complete.contains(p)) {
                    complete.insert(id.clone());
                    order.push(id.clone());
                }
            }
            if before == complete.len() {
                return Err(fault(CoreFaultCode::DependencyCycle, "nodes"));
            }
        }
        Ok(order)
    }
    /// Uses the handler bound during compilation, never an independently resolved catalog.
    pub(super) async fn execute(&self, work: &Work) -> Result<Values> {
        if work.artifact != self.identity {
            return Err(fault(CoreFaultCode::ArtifactMismatch, "work"));
        }
        let op = self
            .artifact
            .operations
            .get(&work.operation)
            .ok_or_else(|| fault(CoreFaultCode::UnknownOperation, "work"))?;
        self.values(&op.inputs, &work.inputs)?;
        let values = (self.handlers[&work.operation])(work.inputs.clone()).await?;
        self.values(&op.outputs, &values)?;
        Ok(values)
    }
}
pub(super) fn digest(value: &impl serde::Serialize) -> Result<String> {
    let bytes =
        serde_json::to_vec(value).map_err(|_| fault(CoreFaultCode::Serialization, "artifact"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}
