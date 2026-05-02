import { Renderer, TreeNodeSelection, TreeNode } from 'topola';
import { CompositeRenderer } from 'topola/dist/composite-renderer';
import { HierarchyNode } from 'd3-hierarchy';
import * as d3 from 'd3';

export interface NodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: TreeNode;
}

export class CustomNodeRenderer extends CompositeRenderer implements Renderer {
  private onNodesUpdated: (nodes: NodeData[]) => void;

  constructor(options: { horizontal?: boolean }, onNodesUpdated: (nodes: NodeData[]) => void) {
    super(options);
    this.onNodesUpdated = onNodesUpdated;
  }

  getPreferredIndiSize(id: string): [number, number] {
    // Width and height of FamilyMemberCard
    return [260, 140];
  }

  getPreferredFamSize(id: string): [number, number] {
    // Size of the family connector (just a point or a small circle)
    return [20, 20];
  }

  render(enter: TreeNodeSelection, update: TreeNodeSelection): void {
    // Create foreignObjects for individuals
    const indiEnter = enter.filter(d => !!d.data.indi);
    indiEnter.append('foreignObject')
      .attr('class', 'indi-container')
      .attr('width', d => d.data.width || 260)
      .attr('height', d => d.data.height || 140)
      .attr('id', d => `indi-fo-${d.data.id}`)
      .attr('x', d => (this.options.horizontal ? 0 : -(d.data.width || 260) / 2))
      .attr('y', d => (this.options.horizontal ? -(d.data.height || 140) / 2 : 0));

    // For families, we just draw a small circle
    const famEnter = enter.filter(d => !!d.data.family);
    famEnter.append('circle')
      .attr('r', 4)
      .attr('fill', '#16334a');

    // Update positions via transition is handled by Topola Chart, but we need to ensure sizes are correct
    update.select('foreignObject.indi-container')
      .attr('width', d => d.data.width || 260)
      .attr('height', d => d.data.height || 140);
  }

  updateNodes(nodes: Array<HierarchyNode<TreeNode>>): void {
    super.updateNodes(nodes);
    // Extract node positions for React
    const nodeData: NodeData[] = nodes.map(node => {
      // Topola stores coords on the node object directly after layout
      const anyNode = node as any;
      return {
        id: node.data.id,
        x: anyNode.x,
        y: anyNode.y,
        width: node.data.width || 260,
        height: node.data.height || 140,
        data: node.data
      };
    });
    this.onNodesUpdated(nodeData);
  }

  getCss(): string {
    return `
      .link {
        fill: none;
        stroke: #16334a;
        stroke-width: 2px;
        opacity: 0.3;
      }
    `;
  }
}
