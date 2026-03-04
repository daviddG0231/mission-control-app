'use client'

import { useState } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { BookOpen, File, FolderOpen, Search, RefreshCw, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

interface DocContent {
  content: string
  name: string
  path: string
  size: number
  modified: string
}

interface DocsResponse {
  files: DocFile[]
  error?: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  children?: Record<string, TreeNode>
}

// Build tree structure from flat file list
function buildFileTree(files: DocFile[]): TreeNode {
  const tree: TreeNode = { name: 'docs', type: 'directory', path: '', children: {} }
  
  files.forEach(file => {
    const parts = file.path.split('/')
    let current = tree
    
    parts.forEach((part, index) => {
      if (!current.children![part]) {
        const isFile = index === parts.length - 1 && file.type === 'file'
        current.children![part] = {
          name: part,
          path: file.path,
          type: isFile ? 'file' : 'directory',
          size: isFile ? file.size : undefined,
          modified: isFile ? file.modified : undefined,
          children: isFile ? undefined : {}
        }
      }
      if (current.children![part].children) {
        current = current.children![part]
      }
    })
  })
  
  return tree
}

// Render tree component
function TreeNodeComponent({ node, selectedFile, onFileSelect, depth = 0 }: {
  node: TreeNode
  selectedFile: string | null
  onFileSelect: (path: string) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 1) // Auto-expand top level
  
  if (node.type === 'file') {
    return (
      <div
        onClick={() => onFileSelect(node.path)}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded cursor-pointer transition',
          'hover:bg-[var(--bg-hover)] text-sm',
          selectedFile === node.path && 'bg-[var(--bg-hover)] text-[var(--accent)]'
        )}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <File className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    )
  }
  
  const hasChildren = node.children && Object.keys(node.children).length > 0
  
  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded transition text-sm',
          hasChildren ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'text-[var(--text-secondary)]'
        )}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <FolderOpen className={cn('w-3.5 h-3.5 flex-shrink-0', expanded ? 'rotate-0' : '-rotate-90')} />
        ) : (
          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {Object.values(node.children!).map((child: TreeNode) => (
            <TreeNodeComponent
              key={child.path || child.name}
              node={child}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocsPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [docContent, setDocContent] = useState<DocContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: docsData, loading: docsLoading, refetch } = useGatewayData<DocsResponse>('/api/docs', 60000)
  
  const files = docsData?.files || []
  const tree = buildFileTree(files)
  
  // Filter files based on search
  const filteredFiles = searchTerm
    ? files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.path.toLowerCase().includes(searchTerm.toLowerCase()))
    : files
  
  const loadDocContent = async (filePath: string) => {
    if (selectedFile === filePath && docContent) return
    
    setSelectedFile(filePath)
    setContentLoading(true)
    
    try {
      const response = await fetch(`/api/docs?file=${encodeURIComponent(filePath)}`)
      if (response.ok) {
        const content = await response.json()
        setDocContent(content)
      } else {
        setDocContent(null)
      }
    } catch (error) {
      console.error('Error loading doc:', error)
      setDocContent(null)
    } finally {
      setContentLoading(false)
    }
  }
  
  return (
    <div className="h-full flex">
      {/* Docs Tree Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-card)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--accent)]" />
              Docs
            </h1>
            <button
              onClick={refetch}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition"
              title="Refresh docs"
            >
              <RefreshCw className={cn('w-4 h-4 text-[var(--text-secondary)]', docsLoading && 'animate-spin')} />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm text-white placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            />
          </div>
          
          <p className="text-xs text-[var(--text-secondary)]">
            OpenClaw documentation browser
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {docsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4 mb-2" />
                </div>
              ))}
            </div>
          ) : searchTerm ? (
            // Show search results
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Search Results ({filteredFiles.length})
              </h3>
              {filteredFiles.map(file => (
                file.type === 'file' && (
                  <div
                    key={file.path}
                    onClick={() => loadDocContent(file.path)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded cursor-pointer transition text-sm',
                      'hover:bg-[var(--bg-hover)]',
                      selectedFile === file.path && 'bg-[var(--bg-hover)] text-[var(--accent)]'
                    )}
                  >
                    <File className="w-3.5 h-3.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{file.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">{file.path}</div>
                    </div>
                  </div>
                )
              ))}
              {filteredFiles.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-4">No matching files found</p>
              )}
            </div>
          ) : (
            // Show file tree
            <div>
              <TreeNodeComponent
                node={tree}
                selectedFile={selectedFile}
                onFileSelect={loadDocContent}
              />
              {files.length === 0 && !docsData?.error && (
                <div className="text-center py-8">
                  <BookOpen className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-[var(--text-secondary)]">No documentation found</p>
                </div>
              )}
              {docsData?.error && (
                <div className="text-center py-8">
                  <BookOpen className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-[var(--text-secondary)]">{docsData.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Content Viewer */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        {selectedFile ? (
          <>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{docContent?.name || selectedFile.split('/').pop()}</h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mt-1">
                    <span>{selectedFile}</span>
                    {docContent?.size && <span>{formatFileSize(docContent.size)}</span>}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {contentLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-[var(--bg-card)] rounded w-full mb-2" />
                    </div>
                  ))}
                </div>
              ) : docContent ? (
                <div className="prose prose-invert max-w-none">
                  <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
                    {docContent.content}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-[var(--text-secondary)]">Failed to load documentation</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold text-white mb-2">OpenClaw Documentation</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Select a documentation file to view its content
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}