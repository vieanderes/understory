/*
 * Runs in <head> before first paint, beside the theme script. With motion allowed, it lets
 * CSS hold arriving elements back from the very first frame, so a title never flashes in,
 * vanishes and then animates. Under reduced motion nothing is marked and nothing is held.
 * The mark draws itself once per browser session.
 */
export const MOTION_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.dataset.motion='on';if(!sessionStorage.getItem('understory:mark')){sessionStorage.setItem('understory:mark','1');d.dataset.markDraw='on';}}catch(e){}})();`;
