"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactNode, useState } from 'react';
import { 
  FileText, Brain, Activity, Target, AlertCircle, CheckCircle2, Info,
  ChevronDown, ChevronRight, Stethoscope, FileSearch, Shield, User,
  BarChart3, TrendingUp, Zap
} from 'lucide-react';

interface MarkdownReportProps {
  content: string;
  className?: string;
}

export default function MarkdownReport({ content, className = "" }: MarkdownReportProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Helper to determine section icon based on content
  const getSectionIcon = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('patient')) return <User className="h-5 w-5 text-purple-600" />;
    if (lowerText.includes('evidence')) return <FileSearch className="h-5 w-5 text-blue-600" />;
    if (lowerText.includes('diagnosis')) return <Stethoscope className="h-5 w-5 text-red-600" />;
    if (lowerText.includes('kb') || lowerText.includes('context')) return <Brain className="h-5 w-5 text-indigo-600" />;
    if (lowerText.includes('safety') || lowerText.includes('caveat')) return <Shield className="h-5 w-5 text-orange-600" />;
    if (lowerText.includes('romberg') || lowerText.includes('cotton')) return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (lowerText.includes('fft') || lowerText.includes('spectral')) return <BarChart3 className="h-5 w-5 text-cyan-600" />;
    return <Activity className="h-5 w-5 text-gray-600" />;
  };

  return (
    <div className={`markdown-report ${className} print:text-black`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings with different styles and collapsible sections
          h1: ({ children, ...props }) => {
            const text = String(children);
            const sectionId = text.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const isCollapsed = collapsedSections.has(sectionId);
            
            return (
              <div className="mb-4 mt-6 first:mt-0">
                <h1 
                  className="text-2xl font-bold text-gray-900 flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-colors print:cursor-default" 
                  onClick={() => toggleSection(sectionId)}
                  {...props}
                >
                  {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  {getSectionIcon(text)}
                  {children}
                </h1>
              </div>
            );
          },
          h2: ({ children, ...props }) => {
            const text = String(children);
            return (
              <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-5 border-b border-gray-200 pb-2 flex items-center gap-2 print:break-before-avoid" {...props}>
                {getSectionIcon(text)}
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-medium text-gray-700 mb-2 mt-4 flex items-center gap-2 print:break-before-avoid" {...props}>
              <Zap className="h-4 w-4 text-yellow-600" />
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="text-base font-medium text-gray-600 mb-2 mt-3" {...props}>
              {children}
            </h4>
          ),
          
          // Paragraphs with better spacing and highlighting
          p: ({ children, ...props }) => {
            const text = String(children);
            // Highlight important patterns
            let className = "text-sm text-gray-700 mb-3 leading-relaxed print:leading-normal";
            if (text.includes('Patient:') || text.includes('Header')) {
              className += " font-semibold text-gray-900";
            }
            if (text.includes('RANK') || text.includes('Primary') || text.includes('Diagnosis:')) {
              className += " bg-yellow-50 p-2 rounded border-l-4 border-yellow-400 print:bg-transparent print:border-l-2";
            }
            return (
              <p className={className} {...props}>
                {children}
              </p>
            );
          },
          
          // Lists with custom styling and better spacing
          ul: ({ children, ...props }) => (
            <ul className="ml-4 mb-3 space-y-1.5 print:space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="ml-4 mb-3 space-y-1.5 list-decimal list-inside print:space-y-1" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            const childrenArray = Array.isArray(children) ? children : [children];
            const text = childrenArray.join('');
            
            // Special formatting for different types of list items
            let icon = null;
            let textClass = "text-sm text-gray-700";
            
            if (typeof text === 'string') {
              if (text.toLowerCase().includes('diagnosis') || text.toLowerCase().includes('finding')) {
                icon = <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0 mt-0.5" />;
                textClass = "text-sm text-orange-800";
              } else if (text.toLowerCase().includes('normal') || text.toLowerCase().includes('within')) {
                icon = <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />;
                textClass = "text-sm text-green-800";
              } else if (text.toLowerCase().includes('note') || text.toLowerCase().includes('kb')) {
                icon = <Info className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />;
                textClass = "text-sm text-blue-800";
              }
            }
            
            return (
              <li className="flex items-start gap-2" {...props}>
                {icon}
                <span className={textClass}>{children}</span>
              </li>
            );
          },
          
          // Strong/bold text with highlighting for key metrics
          strong: ({ children, ...props }) => {
            const text = String(children);
            let className = "font-semibold text-gray-900";
            // Highlight specific important terms
            if (text.includes('increased') || text.includes('elevated') || text.includes('high')) {
              className += " text-red-700 bg-red-50 px-1 rounded";
            } else if (text.includes('decreased') || text.includes('reduced') || text.includes('low')) {
              className += " text-blue-700 bg-blue-50 px-1 rounded";
            } else if (text.includes('normal') || text.includes('within')) {
              className += " text-green-700 bg-green-50 px-1 rounded";
            }
            return (
              <strong className={className} {...props}>
                {children}
              </strong>
            );
          },
          
          // Emphasis/italic text
          em: ({ children, ...props }) => (
            <em className="italic text-gray-700" {...props}>
              {children}
            </em>
          ),
          
          // Code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-100 text-sm font-mono rounded text-gray-800" {...props}>
                  {children}
                </code>
              );
            }
            
            return (
              <pre className="mb-3 p-3 bg-gray-50 rounded-lg overflow-x-auto">
                <code className="text-xs font-mono text-gray-800" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          
          // Blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 mb-3 italic text-gray-600" {...props}>
              {children}
            </blockquote>
          ),
          
          // Tables with styling
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="bg-white divide-y divide-gray-200" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900" {...props}>
              {children}
            </td>
          ),
          
          // Horizontal rules
          hr: ({ ...props }) => (
            <hr className="my-4 border-gray-200" {...props} />
          ),
          
          // Links
          a: ({ children, href, ...props }) => (
            <a 
              href={href} 
              className="text-blue-600 underline hover:text-blue-800 transition-colors" 
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
