import os
import re

directory = '/home/trubuck-design/Projects/Personal/heard-again/UI/src'

replacements = {
    r'\bArchiveLens\b': 'MemoriesLens',
    r'\bArchiveShell\b': 'MemoriesShell',
    r'\bArchiveGrid\b': 'MemoriesGrid',
    r'\bArchiveProps\b': 'MemoriesProps',
    r'\bArchiveShellProps\b': 'MemoriesShellProps',
    r'\bArchiveGridProps\b': 'MemoriesGridProps',
    r'\barchiveCounts\b': 'memoryCounts',
    r'\barchiveTitle\b': 'memoryTitle',
    r'\barchive_type\b': 'memory_type',
    r'\barchiveStats\b': 'memoryStats',
    r'\bisArchiveLens\b': 'isMemoriesLens',
    r'\bonViewArchive\b': 'onViewMemories',
    r'\bhandleViewArchive\b': 'handleViewMemories',
    r"'/archive\b": "'/memories",
    r'"/archive\b': '"/memories',
    r'`/archive\b': '`/memories',
    r'from\s+[\'"]@/components/archive': 'from \'@/components/memories',
    r'from\s+[\'"]@/components/profile/ArchiveGrid': 'from \'@/components/profile/MemoriesGrid',
    r'\bThe Living Archive\b': 'The Living Memories',
    r'\bArchive view switcher\b': 'Memories view switcher',
    r'\bArchive lens\b': 'Memories lens',
    r'\bArchive Hero\b': 'Memories Hero',
    r'\bArchive stats row\b': 'Memories stats row',
    r'\bArchive\b': 'Memories',
    r'\barchive\b(?!(\.ts|\.tsx|/))': 'memories', # avoids replacing api/stories/[id]/archive.ts or inside paths where it's a verb/file
}

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            # Skip api/stories/[id]/archive.ts because it's a verb
            if 'api/stories' in root and file == 'archive.ts':
                continue
                
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for k, v in replacements.items():
                new_content = re.sub(k, v, new_content)
                
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
