type SetCommandPaletteOpen = (open: boolean) => void;
type GetCommandPaletteOpen = () => boolean;

export function registerCommandPaletteOpenEvents(
  setCommandPaletteOpen: SetCommandPaletteOpen,
  getCommandPaletteOpen: GetCommandPaletteOpen
): () => void {
  const handleToggle = () => {
    setCommandPaletteOpen(!getCommandPaletteOpen());
  };

  const handleOpen = () => {
    setCommandPaletteOpen(true);
  };

  window.addEventListener("command-palette-toggle", handleToggle as EventListener);
  window.addEventListener("command-palette-open", handleOpen as EventListener);

  return () => {
    window.removeEventListener("command-palette-toggle", handleToggle as EventListener);
    window.removeEventListener("command-palette-open", handleOpen as EventListener);
  };
}
