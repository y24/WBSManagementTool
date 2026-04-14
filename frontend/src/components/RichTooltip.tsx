import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RichTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  followMouse?: boolean;
  delay?: number;
}

/**
 * ガントチャートのツールチップのようなリッチな見た目のツールチップを提供します。
 * createPortalを使用して、階層に関係なく最前面に表示されます。
 */
const RichTooltip: React.FC<RichTooltipProps> = ({ 
  content, 
  children, 
  followMouse = true,
  delay = 400 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    // 座標を即座に更新
    setMousePos({ x: e.clientX, y: e.clientY });
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (followMouse) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [followMouse]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  }, []);

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!content) return children;

  return (
    <>
      {React.cloneElement(children as React.ReactElement<any>, {
        onMouseEnter: handleMouseEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
      })}
      {isVisible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 text-[13px] min-w-[200px] max-w-[400px] text-slate-700 dark:text-slate-200 transition-opacity animate-in fade-in duration-200"
          style={{
            left: `${mousePos.x + 15}px`,
            top: `${mousePos.y + 15}px`,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

export default RichTooltip;
