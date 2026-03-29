#!/usr/bin/env node

/**
 * SonarQube Issue Parser for Coding Agents
 * Usage: node parse-sonar-issues.js [options]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const options = {
  severity: 'CRITICAL,MAJOR',
  type: null,
  file: null,
  limit: 10,
  format: 'readable',
  ...Object.fromEntries(
    args.map(arg => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        return [key, value || true];
      }
      return [];
    })
  )
};

function loadIssues() {
  try {
    const issuesFile = path.join(process.cwd(), 'sonar-reports', 'issues-formatted.json');
    if (!fs.existsSync(issuesFile)) {
      console.error('❌ Issues file not found. Run ./get-sonar-report-enhanced.sh first.');
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(issuesFile, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading issues:', error.message);
    process.exit(1);
  }
}

function filterIssues(issues, options) {
  return issues.filter(issue => {
    // Filter by severity
    if (options.severity && !options.severity.split(',').includes(issue.severity)) {
      return false;
    }
    
    // Filter by type
    if (options.type && issue.type !== options.type) {
      return false;
    }
    
    // Filter by file
    if (options.file && !issue.file_path.includes(options.file)) {
      return false;
    }
    
    return true;
  });
}

function formatReadable(issues) {
  console.log(`\n📊 Found ${issues.length} issues\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.severity} - ${issue.type}`);
    console.log(`   📁 File: ${issue.file_path}:${issue.line}`);
    console.log(`   📝 Message: ${issue.message}`);
    console.log(`   🏷️  Rule: ${issue.rule}`);
    console.log(`   ⏱️  Effort: ${issue.effort || 'N/A'}`);
    if (issue.quick_fix_available) {
      console.log(`   🔧 Quick fix available`);
    }
    console.log('');
  });
}

function formatJSON(issues) {
  console.log(JSON.stringify(issues, null, 2));
}

function formatCommands(issues) {
  console.log('\n🔧 Suggested fix commands:\n');
  
  issues.forEach((issue, index) => {
    console.log(`# ${index + 1}. Fix ${issue.rule} in ${issue.file_path}:${issue.line}`);
    console.log(`# ${issue.message}`);
    console.log(`# Priority: ${issue.severity} | Effort: ${issue.effort || 'N/A'}`);
    console.log(`# File: ${issue.file_path}`);
    console.log('');
  });
}

function main() {
  const data = loadIssues();
  let issues = filterIssues(data.issues, options);
  
  // Sort by severity and effort
  const severityOrder = { BLOCKER: 0, CRITICAL: 1, MAJOR: 2, MINOR: 3, INFO: 4 };
  issues.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return (a.effort || '999').localeCompare(b.effort || '999');
  });
  
  // Apply limit
  if (options.limit && options.limit > 0) {
    issues = issues.slice(0, options.limit);
  }
  
  // Format output
  switch (options.format) {
    case 'json':
      formatJSON(issues);
      break;
    case 'commands':
      formatCommands(issues);
      break;
    default:
      formatReadable(issues);
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadIssues, filterIssues };
