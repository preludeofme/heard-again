#!/bin/bash

# Enhanced SonarQube Report Export Script for Coding Agents
# Usage: ./get-sonar-report-enhanced.sh

SONAR_URL="${SONAR_URL:-http://localhost:9000}"
TOKEN="${SONAR_TOKEN:?SONAR_TOKEN must be set (export SONAR_TOKEN=your_token)}"
PROJECT_KEY="heard-again"
OUTPUT_DIR="sonar-reports"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📊 Exporting enhanced SonarQube reports for $PROJECT_KEY..."

# 1. Overall Metrics
echo "🔍 Getting overall metrics..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/measures/component?component=$PROJECT_KEY&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,sqale_rating,reliability_rating,security_rating" \
  > "$OUTPUT_DIR/metrics.json"

# 2. Formatted Issues for Coding Agents
echo "🚨 Getting formatted issues..."

# Get all issues and format them for coding agents
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&ps=500" \
  | jq '{
    total_issues: .total,
    paging: .paging,
    issues: [.issues[] | {
      key: .key,
      rule: .rule,
      severity: .severity,
      type: .type,
      component: .component,
      line: .textRange.startLine,
      end_line: .textRange.endLine,
      message: .message,
      effort: .effort,
      debt: .debt,
      tags: .tags,
      file_path: (.component | split(":") | .[1]),
      quick_fix_available: .quickFixAvailable,
      impacts: .impacts,
      clean_code_attribute: .cleanCodeAttribute,
      clean_code_attribute_category: .cleanCodeAttributeCategory
    }]
  }' > "$OUTPUT_DIR/issues-formatted.json"

# 3. Critical Issues Summary (high priority fixes)
echo "🚨 Getting critical issues summary..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&severities=BLOCKER,CRITICAL&ps=100" \
  | jq '{
    critical_count: .total,
    issues: [.issues[] | {
      file: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule: .rule,
      message: .message,
      severity: .severity,
      type: .type,
      effort: .effort,
      quick_fix: .quickFixAvailable
    }]
  }' > "$OUTPUT_DIR/critical-issues-summary.json"

# 4. Code Smells by Priority
echo "📝 Getting code smells by priority..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=CODE_SMELL&ps=200" \
  | jq '{
    code_smells_count: .total,
    high_priority: [.issues[] | select(.severity == "CRITICAL" or .severity == "MAJOR") | {
      file: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule: .rule,
      message: .message,
      severity: .severity,
      effort: .effort,
      clean_code_attribute: .cleanCodeAttribute,
      category: .cleanCodeAttributeCategory
    }],
    medium_priority: [.issues[] | select(.severity == "MINOR") | {
      file: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule: .rule,
      message: .message,
      severity: .severity,
      effort: .effort
    }]
  }' > "$OUTPUT_DIR/code-smells-priority.json"

# 5. Bugs Summary
echo "🐛 Getting bugs summary..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=BUG&ps=100" \
  | jq '{
    bugs_count: .total,
    bugs: [.issues[] | {
      file: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule: .rule,
      message: .message,
      severity: .severity,
      effort: .effort,
      impacts: .impacts
    }]
  }' > "$OUTPUT_DIR/bugs-summary.json"

# 6. Security Issues
echo "🔒 Getting security issues..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=VULNERABILITY&ps=100" \
  | jq '{
    security_count: .total,
    vulnerabilities: [.issues[] | {
      file: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule: .rule,
      message: .message,
      severity: .severity,
      effort: .effort,
      security_impact: .impacts
    }]
  }' > "$OUTPUT_DIR/security-summary.json"

# 7. File-based Summary (grouped by file for easier fixing)
echo "📁 Creating file-based summary..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&ps=500" \
  | jq '{
    files: [.issues[] | group_by(.component) | .[] | {
      file_path: (.[0].component | split(":") | .[1]),
      issue_count: length,
      issues: [.[] | {
        line: .textRange.startLine,
        rule: .rule,
        message: .message,
        severity: .severity,
        type: .type,
        effort: .effort
      }] | sort_by(.line)
    }] | sort_by(.issue_count | reverse)
  }' > "$OUTPUT_DIR/files-summary.json"

# 8. Agent-Ready Task List
echo "🤖 Creating agent-ready task list..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&ps=500" \
  | jq '{
    total_tasks: .total,
    tasks: [.issues[] | select(.severity == "CRITICAL" or .severity == "MAJOR") | {
      priority: (if .severity == "CRITICAL" then "high" elif .severity == "MAJOR" then "medium" else "low" end),
      task_id: .key,
      file_path: (.component | split(":") | .[1]),
      line: .textRange.startLine,
      rule_id: .rule,
      description: .message,
      type: .type,
      estimated_effort: .effort,
      quick_fix_available: .quickFixAvailable,
      tags: .tags
    }] | sort_by(.priority, .estimated_effort)
  }' > "$OUTPUT_DIR/agent-tasks.json"

# 9. Create a human-readable summary
echo "📋 Creating summary report..."
cat > "$OUTPUT_DIR/README.md" << EOF
# SonarQube Analysis Report

## Overview
This report contains formatted SonarQube issues optimized for coding agents to review and fix.

## Files Available
- \`issues-formatted.json\` - All issues with full details
- \`critical-issues-summary.json\` - Critical and Blocker issues only
- \`code-smells-priority.json\` - Code smells grouped by priority
- \`bugs-summary.json\` - All bugs with details
- \`security-summary.json\` - Security vulnerabilities
- \`files-summary.json\` - Issues grouped by file
- \`agent-tasks.json\` - Tasks ready for agent execution
- \`metrics.json\` - Overall project metrics

## Quick Stats
\$(cat "$OUTPUT_DIR/metrics.json" | jq -r '
  "🐛 Bugs: " + (.component.measures[] | select(.metric == "bugs").value // "0") + 
  " | 🔒 Vulnerabilities: " + (.component.measures[] | select(.metric == "vulnerabilities").value // "0") + 
  " | 📝 Code Smells: " + (.component.measures[] | select(.metric == "code_smells").value // "0") + 
  " | 📊 Coverage: " + (.component.measures[] | select(.metric == "coverage").value // "0") + "%"
')

## Priority Actions
\$(cat "$OUTPUT_DIR/critical-issues-summary.json" | jq -r '
  if .critical_count > 0 then
    "🚨 **" + (.critical_count | tostring) + " critical issues need immediate attention**"
  else
    "✅ No critical issues found"
  end
')

## Agent Usage
Use \`agent-tasks.json\` for a prioritized list of fixes:
\`\`\`bash
# Show top 5 tasks
jq '.tasks[0:4]' sonar-reports/agent-tasks.json

# Show tasks for a specific file
jq '.tasks[] | select(.file_path == "src/lib/security/malware-scanner.ts")' sonar-reports/agent-tasks.json
\`\`\`

Generated on: $(date)
EOF

echo "✅ Enhanced reports exported to $OUTPUT_DIR/"
echo ""
echo "📋 Available files:"
ls -la "$OUTPUT_DIR/"*.json "$OUTPUT_DIR/README.md"

echo ""
echo "🔗 Dashboard: $SONAR_URL/dashboard?id=$PROJECT_KEY"
echo "🤖 Agent-ready files created for automated fixing"
echo ""
echo "📖 View summary: cat $OUTPUT_DIR/README.md"
echo "🎯 View tasks: cat $OUTPUT_DIR/agent-tasks.json | jq '.tasks[0:4]'"
