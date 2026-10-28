import { useRef } from 'react';

/**
 * Хук для безопасного закрытия модального окна по клику на подложку (backdrop).
 * Предотвращает ложное срабатывание, когда пользователь начинает выделять текст мышью внутри инпута (mousedown),
 * протягивает курсор за границу окна/инпута и отпускает клавишу мыши над подложкой (mouseup).
 * Закрытие срабатывает ТОЛЬКО если и нажатие (mousedown/touchstart), и клик произошли непосредственно на оверлее.
 */
export const useBackdropDismiss = (onClose) => {
  const isPointerDownOnBackdrop = useRef(false);

  const handlePointerDown = (e) => {
    isPointerDownOnBackdrop.current = e.target === e.currentTarget;
  };

  const handleClick = (e) => {
    if (isPointerDownOnBackdrop.current && e.target === e.currentTarget) {
      if (typeof onClose === 'function') {
        onClose();
      }
    }
    isPointerDownOnBackdrop.current = false;
  };

  return {
    onMouseDown: handlePointerDown,
    onTouchStart: handlePointerDown,
    onClick: handleClick,
  };
};
