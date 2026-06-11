//! Tag-Aware Scheduling — circular dependency detection

use std::collections::{HashMap, HashSet};

/// Detect if adding `proposed_prereqs` to `tag_id` would create a circular dependency.
///
/// `all_tags_prereqs` maps each tag_id → its current prerequisites.
/// Uses DFS to check if any of the proposed prerequisites transitively depends on `tag_id`.
pub fn detect_circular(
    tag_id: &str,
    proposed_prereqs: &[String],
    all_tags_prereqs: &HashMap<String, Vec<String>>,
) -> bool {
    // Build the graph as if the proposed change is in effect:
    // tag_id → proposed_prereqs
    let mut graph: HashMap<String, Vec<String>> = all_tags_prereqs
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    graph.insert(tag_id.to_string(), proposed_prereqs.to_vec());

    // Check: for each proposed prerequisite, does it transitively reach tag_id?
    for prereq_id in proposed_prereqs {
        if prereq_id == tag_id {
            // Self-reference
            return true;
        }
        if dfs_reachable(prereq_id, tag_id, &graph, &mut HashSet::new()) {
            return true;
        }
    }

    false
}

/// Check if `target` is reachable from `start` via directed edges.
fn dfs_reachable(
    start: &str,
    target: &str,
    graph: &HashMap<String, Vec<String>>,
    visited: &mut HashSet<String>,
) -> bool {
    if start == target {
        return true;
    }
    if !visited.insert(start.to_string()) {
        return false;
    }
    if let Some(neighbors) = graph.get(start) {
        for neighbor in neighbors {
            if dfs_reachable(neighbor, target, graph, visited) {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(s: &str) -> String {
        s.to_string()
    }

    fn graph(edges: &[(&str, &[&str])]) -> HashMap<String, Vec<String>> {
        edges
            .iter()
            .map(|(k, v)| (t(k), v.iter().map(|x| t(x)).collect()))
            .collect()
    }

    #[test]
    fn test_no_cycle() {
        let g = graph(&[("B", &["A"]), ("C", &["B"])]);
        // Adding A → [] is fine
        assert!(!detect_circular("A", &[], &g));
        // Adding C → ["A"] is fine (A doesn't transitively depend on C)
        assert!(!detect_circular("C", &[t("A")], &g));
    }

    #[test]
    fn test_direct_cycle() {
        let g = graph(&[("B", &["A"])]);
        // Adding A → ["B"] would create cycle A → B → A
        assert!(detect_circular("A", &[t("B")], &g));
    }

    #[test]
    fn test_transitive_cycle() {
        let g = graph(&[("B", &["A"]), ("C", &["B"])]);
        // Adding A → ["C"] would create A → C → B → A
        assert!(detect_circular("A", &[t("C")], &g));
    }

    #[test]
    fn test_self_reference() {
        let g = HashMap::new();
        assert!(detect_circular("A", &[t("A")], &g));
    }

    #[test]
    fn test_valid_extension() {
        // B → A, adding C → B → A is fine
        let g = graph(&[("B", &["A"])]);
        assert!(!detect_circular("C", &[t("B")], &g));
    }
}
