/**
 * Setzt den echten Scroll-Container eines Ant-Design-Drawers (.ant-drawer-body)
 * auf scrollTop = 0. Auf dem iPad öffnet Safari den Drawer sonst gelegentlich an
 * den zuletzt gescrollten/fokussierten Fuß, sodass nur „Speichern“ sichtbar ist.
 * Sofort und zusätzlich im nächsten Frame anwenden (nach Portal-/Öffnen-Animation).
 */
export function resetDrawerScrollTop(rootClassName: string): void {
  if (typeof document === "undefined") return;
  const apply = () => {
    const body = document.querySelector(`.${rootClassName} .ant-drawer-body`);
    if (body instanceof HTMLElement) body.scrollTop = 0;
  };
  apply();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(apply);
}
