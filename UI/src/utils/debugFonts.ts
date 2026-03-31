// Font debugging utility
export const debugFonts = () => {
  if (typeof window !== 'undefined') {
    console.log('Available fonts:', document.fonts)
    console.log('Manrope loaded:', document.fonts.check('12px Manrope'))
    console.log('Newsreader loaded:', document.fonts.check('12px Newsreader'))
    
    // Check CSS variables
    const rootStyle = getComputedStyle(document.documentElement)
    console.log('Font variables:', {
      manrope: rootStyle.getPropertyValue('--font-manrope'),
      newsreader: rootStyle.getPropertyValue('--font-newsreader'),
    })
  }
}
