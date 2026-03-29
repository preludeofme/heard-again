# SonarQube Analysis Report

## Overview
This report contains formatted SonarQube issues optimized for coding agents to review and fix.

## Files Available
- `issues-formatted.json` - All issues with full details
- `critical-issues-summary.json` - Critical and Blocker issues only
- `code-smells-priority.json` - Code smells grouped by priority
- `bugs-summary.json` - All bugs with details
- `security-summary.json` - Security vulnerabilities
- `files-summary.json` - Issues grouped by file
- `agent-tasks.json` - Tasks ready for agent execution
- `metrics.json` - Overall project metrics

## Quick Stats
$(cat "sonar-reports/metrics.json" | jq -r '
  "🐛 Bugs: " + (.component.measures[] | select(.metric == "bugs").value // "0") + 
  " | 🔒 Vulnerabilities: " + (.component.measures[] | select(.metric == "vulnerabilities").value // "0") + 
  " | 📝 Code Smells: " + (.component.measures[] | select(.metric == "code_smells").value // "0") + 
  " | 📊 Coverage: " + (.component.measures[] | select(.metric == "coverage").value // "0") + "%"
')

## Priority Actions
$(cat "sonar-reports/critical-issues-summary.json" | jq -r '
  if .critical_count > 0 then
    "🚨 **" + (.critical_count | tostring) + " critical issues need immediate attention**"
  else
    "✅ No critical issues found"
  end
')

## Agent Usage
Use `agent-tasks.json` for a prioritized list of fixes:
```bash
# Show top 5 tasks
jq '.tasks[0:4]' sonar-reports/agent-tasks.json

# Show tasks for a specific file
jq '.tasks[] | select(.file_path == "src/lib/security/malware-scanner.ts")' sonar-reports/agent-tasks.json
```

Generated on: Sat Mar 28 04:41:35 PM CDT 2026
