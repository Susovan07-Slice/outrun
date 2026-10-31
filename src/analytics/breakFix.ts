/**
 * src/analytics/breakFix.ts
 * 
 * Outrun Phase 4C & 4D: THE BREAK & THE FIX
 * Graphology Corridor Connectivity, Critical Link Bottleneck Ranking, and Simulation Engine
 * 
 * Requirements:
 * - Graphology graph:
 *     nodes = suitable-cell clusters (with latitude-corrected area_km2)
 *     edges = within documented species dispersal distance
 * - The Break:
 *     Remove each node, compute loss of reachable suitable area and connected components.
 *     Rank as "candidate critical links".
 * - The Fix:
 *     POST /api/simulate to protect/restore a node, recompute the SAME metric.
 *     Return baseline, result, difference, assumptions.
 * - Non-negotiable: NEVER claim animals saved.
 */

import Graph from 'graphology';

export interface CorridorNode {
  id: string; // e.g. "cell_45.0_15.0"
  lat: number;
  lon: number;
  area_km2: number;
  suitability: number;
  uncertainty: number;
  is_protected?: boolean;
}

export interface CriticalLinkRank {
  node_id: string;
  lat: number;
  lon: number;
  area_km2: number;
  suitability: number;
  loss_of_reachable_area_km2: number;
  loss_percent: number;
  connected_components_increase: number;
  criticality_score: number; // Combined impact score
  rank: number;
}

export interface ConnectivityMetrics {
  total_suitable_nodes: number;
  total_suitable_area_km2: number;
  reachable_suitable_area_km2: number;
  connected_components: number;
  network_edges: number;
  largest_component_size: number;
}

export interface SimulationResult {
  success: boolean;
  species_id: string;
  season: 'breeding' | 'non_breeding';
  target_node_id: string;
  action: 'protect' | 'restore';
  label: 'simulated';
  baseline: ConnectivityMetrics;
  result: ConnectivityMetrics;
  difference: {
    reachable_area_delta_km2: number;
    reachable_area_percent_change: number;
    components_delta: number;
    edges_delta: number;
  };
  assumptions: string[];
}

const EARTH_RADIUS_KM = 6371.0;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(1));
}

/**
 * Calculates latitude-corrected area for a ~5-degree grid cell.
 * Area = (5 * 111.13) * (5 * 111.13 * cos(lat)) km^2
 */
export function calculateCellAreaKm2(lat: number, stepDeg: number = 5.0): number {
  const dy = stepDeg * 111.132;
  const dx = stepDeg * 111.132 * Math.cos(lat * DEG_TO_RAD);
  return Number(Math.max(1000, dy * dx).toFixed(0));
}

/**
 * Finds all connected components in an undirected Graphology graph using Breadth-First Search.
 */
export function findConnectedComponents(graph: Graph): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.nodes()) {
    if (!visited.has(node)) {
      const component: string[] = [];
      const queue: string[] = [node];
      visited.add(node);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);

        for (const neighbor of graph.neighbors(curr)) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(component);
    }
  }

  // Sort components by node count descending
  return components.sort((a, b) => b.length - a.length);
}

/**
 * Builds a Graphology corridor graph from a set of suitable cells and maximum flight step distance.
 */
export function buildCorridorGraph(
  nodes: CorridorNode[],
  maxDispersalDistanceKm: number = 1200
): Graph {
  const graph = new Graph({ type: 'undirected', multi: false });

  // 1. Add nodes
  for (const n of nodes) {
    graph.addNode(n.id, {
      lat: n.lat,
      lon: n.lon,
      area_km2: n.area_km2,
      suitability: n.suitability,
      uncertainty: n.uncertainty,
      is_protected: Boolean(n.is_protected),
    });
  }

  // 2. Add edges for pairs within dispersal distance
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = haversineDistanceKm(nodes[i].lat, nodes[i].lon, nodes[j].lat, nodes[j].lon);
      if (dist <= maxDispersalDistanceKm) {
        graph.addEdge(nodes[i].id, nodes[j].id, {
          distance_km: dist,
        });
      }
    }
  }

  return graph;
}

/**
 * Computes global connectivity metrics for a given corridor graph.
 */
export function computeConnectivityMetrics(graph: Graph): ConnectivityMetrics {
  const nodes = graph.nodes();
  if (nodes.length === 0) {
    return {
      total_suitable_nodes: 0,
      total_suitable_area_km2: 0,
      reachable_suitable_area_km2: 0,
      connected_components: 0,
      network_edges: 0,
      largest_component_size: 0,
    };
  }

  let totalArea = 0;
  for (const n of nodes) {
    totalArea += Number(graph.getNodeAttribute(n, 'area_km2') || 0);
  }

  const components = findConnectedComponents(graph);
  const largestComponent = components[0] || [];

  let reachableArea = 0;
  for (const n of largestComponent) {
    reachableArea += Number(graph.getNodeAttribute(n, 'area_km2') || 0);
  }

  return {
    total_suitable_nodes: nodes.length,
    total_suitable_area_km2: Math.round(totalArea),
    reachable_suitable_area_km2: Math.round(reachableArea),
    connected_components: components.length,
    network_edges: graph.edges().length,
    largest_component_size: largestComponent.length,
  };
}

/**
 * THE BREAK: Evaluates node removal sensitivity across the network
 * and ranks nodes as "candidate critical links".
 */
export function rankCriticalLinks(
  nodes: CorridorNode[],
  maxDispersalDistanceKm: number = 1200
): CriticalLinkRank[] {
  const baseGraph = buildCorridorGraph(nodes, maxDispersalDistanceKm);
  const baselineMetrics = computeConnectivityMetrics(baseGraph);

  const rankings: CriticalLinkRank[] = [];

  for (const targetNode of nodes) {
    // Clone graph without the target node
    const subNodes = nodes.filter((n) => n.id !== targetNode.id);
    const subGraph = buildCorridorGraph(subNodes, maxDispersalDistanceKm);
    const subMetrics = computeConnectivityMetrics(subGraph);

    // Compute loss of reachable suitable area
    const areaLoss = Math.max(
      0,
      baselineMetrics.reachable_suitable_area_km2 - subMetrics.reachable_suitable_area_km2
    );
    const lossPercent =
      baselineMetrics.reachable_suitable_area_km2 > 0
        ? Number(((areaLoss / baselineMetrics.reachable_suitable_area_km2) * 100).toFixed(2))
        : 0;

    const componentsIncrease = Math.max(
      0,
      subMetrics.connected_components - baselineMetrics.connected_components
    );

    // Composite criticality score: weighted area loss + component fragmentation penalty
    const criticalityScore = Number((areaLoss / 1000 + componentsIncrease * 250).toFixed(1));

    rankings.push({
      node_id: targetNode.id,
      lat: targetNode.lat,
      lon: targetNode.lon,
      area_km2: targetNode.area_km2,
      suitability: targetNode.suitability,
      loss_of_reachable_area_km2: Math.round(areaLoss),
      loss_percent: lossPercent,
      connected_components_increase: componentsIncrease,
      criticality_score: criticalityScore,
      rank: 0, // Populated below
    });
  }

  // Sort by criticality score descending
  rankings.sort((a, b) => b.criticality_score - a.criticality_score);

  // Assign ranks
  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank = i + 1;
  }

  return rankings;
}

/**
 * THE FIX: Simulates protection or restoration of a node in the network.
 * Returns baseline, result, difference, and transparent methodological assumptions.
 * Strictly adheres to rule: NEVER claim animals saved.
 */
export function simulateNodeProtection(
  speciesId: string,
  season: 'breeding' | 'non_breeding',
  nodes: CorridorNode[],
  targetNodeId: string,
  action: 'protect' | 'restore' = 'protect',
  maxDispersalDistanceKm: number = 1200
): SimulationResult {
  const baseGraph = buildCorridorGraph(nodes, maxDispersalDistanceKm);
  const baselineMetrics = computeConnectivityMetrics(baseGraph);

  // Apply protection / restoration
  const simulatedNodes = nodes.map((n) => {
    if (n.id === targetNodeId) {
      return {
        ...n,
        suitability: Math.min(1.0, Number((n.suitability * 1.3).toFixed(2))), // Enhanced habitat quality
        is_protected: true,
      };
    }
    return n;
  });

  // If restoring an edge or bridge
  const simulatedGraph = buildCorridorGraph(simulatedNodes, maxDispersalDistanceKm);
  const resultMetrics = computeConnectivityMetrics(simulatedGraph);

  const areaDelta = resultMetrics.reachable_suitable_area_km2 - baselineMetrics.reachable_suitable_area_km2;
  const areaPercent =
    baselineMetrics.reachable_suitable_area_km2 > 0
      ? Number(((areaDelta / baselineMetrics.reachable_suitable_area_km2) * 100).toFixed(2))
      : 0;

  return {
    success: true,
    species_id: speciesId,
    season,
    target_node_id: targetNodeId,
    action,
    label: 'simulated',
    baseline: baselineMetrics,
    result: resultMetrics,
    difference: {
      reachable_area_delta_km2: areaDelta,
      reachable_area_percent_change: areaPercent,
      components_delta: resultMetrics.connected_components - baselineMetrics.connected_components,
      edges_delta: resultMetrics.network_edges - baselineMetrics.network_edges,
    },
    assumptions: [
      'Corridor topology modeled using Graphology with edges constrained to documented flight step distance (1,200 km).',
      'Node suitability derived strictly from 5th-95th percentile climate envelope; land cover and urban barriers are not modeled.',
      'Protection simulation models topological connectivity retention only and does NOT estimate animal survival or claim species saved.',
    ],
  };
}
