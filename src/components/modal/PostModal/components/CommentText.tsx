import React, { JSX, useMemo } from 'react';
import Link from 'next/link';
import { FileText, ShoppingBag, MapPin, Camera } from 'lucide-react';

interface CommentTextProps {
  content: string;
  metadata?: any;
  className?: string;
  onPostClick?: (id: string | number, meta?: any) => void;
  onProductClick?: (id: string | number, meta?: any) => void;
  onLocationClick?: (meta: any) => void;
  onMediaClick?: (meta: any) => void;
}

interface Match {
  index: number;
  length: number;
  element: JSX.Element;
}

export default function CommentText({ 
  content, 
  metadata, 
  className = "",
  onPostClick,
  onProductClick,
  onLocationClick,
  onMediaClick
}: CommentTextProps) {
  if (!content) return null;

  // 1. Parse Metadata safely
  const parsedMetadata = useMemo(() => {
    if (!metadata) return [];
    let list: any[] = [];
    
    if (Array.isArray(metadata)) {
      list = metadata;
    } else if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        list = Array.isArray(parsed) ? parsed : (parsed.metadata || []);
      } catch (e) { list = []; }
    } else if (typeof metadata === 'object' && metadata !== null) {
      list = metadata.metadata || (Array.isArray(metadata) ? metadata : []);
    }

    return list.filter(m => m && typeof m === 'object');
  }, [metadata]);

  // 2. Build Token List for Unified Parsing
  const tokens = useMemo(() => {
    const list: { pattern: RegExp | string; type: 'mention' | 'attachment'; meta?: any }[] = [];
    list.push({ pattern: /@\[([^\]]+)\]\(([^)]+)\)/, type: 'mention' });
    parsedMetadata.forEach((m: any) => {
      if (m.display) {
        list.push({ pattern: m.display, type: 'attachment', meta: m });
      }
    });
    return list;
  }, [parsedMetadata]);

  const normalize = (str: string) => {
    if (!str) return "";
    // Aggressive normalization of whitespace and hidden characters
    return str.replace(/[\u200B-\u200D\uFEFF\s\t\n\r]/g, '').toLowerCase();
  };

  // 4. Unified Tokenization Logic
  const renderedParts = useMemo(() => {
    let currentText = content;
    const result: (string | JSX.Element)[] = [];
    let safetyCounter = 0;

    while (currentText && safetyCounter < 100) {
      safetyCounter++;
      let bestMatch: Match | null = null;

      // Check all patterns using for...of for better narrowing
      for (const token of tokens) {
        if (token.type === 'mention') {
          const match = (token.pattern as RegExp).exec(currentText);
          if (match && (bestMatch === null || match.index < bestMatch.index)) {
            bestMatch = {
              index: match.index,
              length: match[0].length,
              element: (
                <Link
                  key={`men-${match[2]}-${safetyCounter}-${result.length}`}
                  href={`/${match[2]}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-blue-600 hover:text-rose-500 transition-colors inline-block"
                >
                  @{match[1]}
                </Link>
              )
            };
          }
        } else {
          const m = token.meta;
          const display = m.display;
          
          // Use normalized matching as primary to be resilient to whitespace/ZWSP
          const normDisplay = normalize(display);
          const normText = normalize(currentText);
          const normIdx = normText.indexOf(normDisplay);
          
          if (normIdx !== -1) {
            // Find the actual index and length in the original text
            let currentNormIdx = 0;
            let foundIdx = -1;
            let actualLen = -1;

            for (let i = 0; i < currentText.length; i++) {
              if (currentNormIdx === normIdx && foundIdx === -1) foundIdx = i;
              if (normalize(currentText[i]) !== '') currentNormIdx++;
              if (currentNormIdx === normIdx + normDisplay.length && foundIdx !== -1) {
                actualLen = i + 1 - foundIdx;
                break;
              }
            }

            if (foundIdx !== -1 && actualLen !== -1 && (bestMatch === null || foundIdx < bestMatch.index)) {
              const isPost = m.type === 'post';
              const isProduct = m.type === 'product';
              const isLocation = m.type === 'location';
              const isMedia = m.type === 'media';
              const Icon = isPost ? FileText : isProduct ? ShoppingBag : isLocation ? MapPin : Camera;
              
              bestMatch = {
                index: foundIdx,
                length: actualLen,
                element: (
                  <button
                    key={`att-${m.id}-${safetyCounter}-${result.length}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPost && onPostClick) onPostClick(m.id, m);
                      if (isProduct && onProductClick) onProductClick(m.id, m);
                      if (isLocation && onLocationClick) onLocationClick(m);
                      if (isMedia && onMediaClick) onMediaClick(m);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-full font-bold text-[11px] transition-all active:scale-95 border ${
                      isPost ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 shadow-sm' :
                      isProduct ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 shadow-sm' :
                      isLocation ? 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100 shadow-sm' :
                      'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{display.replace(/[\[\]]/g, '')}</span>
                  </button>
                )
              };
            }
          }
        }
      }

      if (bestMatch) {
        if (bestMatch.index > 0) {
          result.push(currentText.substring(0, bestMatch.index));
        }
        result.push(bestMatch.element);
        currentText = currentText.substring(bestMatch.index + bestMatch.length);
      } else {
        result.push(currentText);
        currentText = "";
      }
    }

    return result;
  }, [content, tokens, onPostClick, onProductClick, onLocationClick, onMediaClick]);

  return (
    <div className={`${className} whitespace-pre-wrap break-words leading-relaxed`}>
      {renderedParts.map((part, i) => (
        <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </div>
  );
}

