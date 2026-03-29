#!/bin/bash

# SonarQube Report Export Script
# Usage: ./get-sonar-report.sh

SONAR_URL="http://localhost:9000"
TOKEN="squ_3131a69179595d70506b93facb243d413e973df0"
PROJECT_KEY="heard-again"
OUTPUT_DIR="sonar-reports"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📊 Exporting SonarQube reports for $PROJECT_KEY..."

# 1. Overall Metrics
echo "🔍 Getting overall metrics..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/measures/component?component=$PROJECT_KEY&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,sqale_rating,reliability_rating,security_rating" \
  > "$OUTPUT_DIR/metrics.json"

# 2. Critical Issues
echo "🚨 Getting critical issues..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&severities=BLOCKER,CRITICAL,MAJOR&ps=100" \
  > "$OUTPUT_DIR/critical-issues.json"

# 3. Security Issues
echo "🔒 Getting security issues..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=VULNERABILITY&severities=CRITICAL,MAJOR&ps=100" \
  > "$OUTPUT_DIR/security-issues.json"

# 4. Code Smells
echo "📝 Getting code smells..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=CODE_SMELL&severities=CRITICAL,MAJOR&ps=100" \
  > "$OUTPUT_DIR/code-smells.json"

# 5. Bugs
echo "🐛 Getting bugs..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&types=BUG&severities=CRITICAL,MAJOR&ps=100" \
  > "$OUTPUT_DIR/bugs.json"

# 6. Security Hotspots
echo "🎯 Getting security hotspots..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/hotspots/search?componentKey=$PROJECT_KEY&status=TO_REVIEW,REVIEWED" \
  > "$OUTPUT_DIR/hotspots.json"

# 7. Project Info
echo "ℹ️ Getting project info..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$SONAR_URL/api/components/show?component=$PROJECT_KEY" \
  > "$OUTPUT_DIR/project-info.json"

echo "✅ Reports exported to $OUTPUT_DIR/"
echo ""
echo "📋 Available files:"
ls -la "$OUTPUT_DIR/"

echo ""
echo "🔗 Dashboard: $SONAR_URL/dashboard?id=$PROJECT_KEY"
echo "📊 Use these JSON files to pass report data to other agents"
