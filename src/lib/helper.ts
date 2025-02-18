export function hexToColorObject(hex: string) {
    if (!/^#[0-9A-F]{6}$/i.test(hex)) {
      throw new Error('Invalid hex color');
    }
  
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
  
    return { red: r, green: g, blue: b };
  }
  