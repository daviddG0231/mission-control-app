'use client'

import { useState } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { FileText, FolderOpen, File, Calendar, HardDrive, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

interface FileContent {
  content: string
  name: string
  path: string
  size: number
  modified: string
}

interface FilesResponse {
  files: FileInfo[]
  error?: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function ContentPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  
  const { data: filesData, loading: filesLoading, refetch } = useGatewayData<FilesResponse>('/api/content', 30000)
  
  const files = filesData?.files || []
  
  // Group files by type
  const workspaceFiles = files.filter(f => !f.path.startsWith('memory/'))
  const memoryFiles = files.filter(f => f.path.startsWith('memory/'))
  
  const loadFileContent = async (filePath: string) => {
    if (selectedFile === filePath && fileContent) return
    
    setSelectedFile(filePath)
    setContentLoading(true)
    
    try {
      const response = await fetch(`/api/content?file=${encodeURIComponent(filePath)}`)
      if (response.ok) {
        const content = await response.json()
        setFileContent(content)
      } else {
        setFileContent(null)
      }
    } catch (error) {
      console.error('Error loading file:', error)
      setFileContent(null)
    } finally {
      setContentLoading(false)
    }
  }
  
  const FileItem = ({ file }: { file: FileInfo }) => (
    <div
      onClick={() => loadFileContent(file.path)}
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition',
        'hover:bg-[var(--bg-hover)] border border-transparent',
        selectedFile === file.path && 'bg-[var(--bg-hover)] border-[var(--accent)]/30'
      )}
    >
      <File className="w-4 h-4 text-[var(--accent)]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{file.name}</p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
          {file.size && <span>{formatFileSize(file.size)}</span>}
          {file.modified && <span>{formatDate(file.modified)}</span>}
        </div>
      </div>
    </div>
  )
  
  return (
    <div className="h-full flex">
      {/* File Tree Sidebar */}
      <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-card)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--accent)]" />
              Content
            </h1>
            <button
              onClick={refetch}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition"
              title="Refresh files"
            >
              <RefreshCw className={cn('w-4 h-4 text-[var(--text-secondary)]', filesLoading && 'animate-spin')} />
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Workspace file browser and content manager
          </p>
        </div>
        
        {filesLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[var(--bg-hover)] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Workspace Config Files */}
            {workspaceFiles.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="w-4 h-4 text-[var(--success)]" />
                  <h3 className="text-sm font-semibold text-white">Workspace Config</h3>
                </div>
                <div className="space-y-1">
                  {workspaceFiles.map(file => (
                    <FileItem key={file.path} file={file} />
                  ))}
                </div>
              </div>
            )}
            
            {/* Memory Files */}
            {memoryFiles.length > 0 && (
              <div className="p-4 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-[var(--warning)]" />
                  <h3 className="text-sm font-semibold text-white">Memory</h3>
                </div>
                <div className="space-y-1">
                  {memoryFiles
                    .sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
                    .map(file => (
                      <FileItem key={file.path} file={file} />
                    ))}
                </div>
              </div>
            )}
            
            {files.length === 0 && (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
                <p className="text-sm text-[var(--text-secondary)]">No files found</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Content Viewer */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        {selectedFile ? (
          <>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{fileContent?.name || selectedFile}</h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mt-1">
                    <span className="flex items-center gap-1">
                      <File className="w-3 h-3" />
                      {selectedFile}
                    </span>
                    {fileContent?.size && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatFileSize(fileContent.size)}
                      </span>
                    )}
                    {fileContent?.modified && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(fileContent.modified)}
                      </span>
                    )}
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
              ) : fileContent ? (
                <pre className="text-sm text-[var(--text-primary)] font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {fileContent.content}
                </pre>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-[var(--text-secondary)]">Failed to load file content</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-semibold text-white mb-2">Select a file to view</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Choose a file from the sidebar to view its content
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}