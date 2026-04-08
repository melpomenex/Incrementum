import { Theme } from '../types/theme';

type LegacyThemeDefinition = {
  label: string;
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  border: string;
  border2: string;
  text: string;
  text2: string;
  text3: string;
  animation?: string;
};

const legacyThemeDefinitions: Record<string, LegacyThemeDefinition> = {
  "midnight": {"label":"Midnight","bg0":"#0b0d0f","bg1":"#111418","bg2":"#181d24","bg3":"#1e242e","bg4":"#252c38","border":"#2a3444","border2":"#3a4a60","text":"#c8d8e8","text2":"#7a9ab8","text3":"#4a6278"},
  "dracula": {"label":"Dracula","bg0":"#282a36","bg1":"#2d303e","bg2":"#343746","bg3":"#3b3f51","bg4":"#44495e","border":"#44475a","border2":"#6272a4","text":"#f8f8f2","text2":"#bd93f9","text3":"#6272a4"},
  "monokai": {"label":"Monokai","bg0":"#272822","bg1":"#2d2e27","bg2":"#383830","bg3":"#3e3d32","bg4":"#49483e","border":"#49483e","border2":"#75715e","text":"#f8f8f2","text2":"#a6e22e","text3":"#75715e"},
  "nord": {"label":"Nord","bg0":"#2e3440","bg1":"#3b4252","bg2":"#434c5e","bg3":"#4c566a","bg4":"#576279","border":"#4c566a","border2":"#5e6779","text":"#eceff4","text2":"#88c0d0","text3":"#616e88"},
  "solarize": {"label":"Solar","bg0":"#002b36","bg1":"#073642","bg2":"#0a3f4e","bg3":"#0d4a5a","bg4":"#1a5c6e","border":"#2aa198","border2":"#586e75","text":"#93a1a1","text2":"#839496","text3":"#586e75"},
  "gruvbox": {"label":"Gruvbox","bg0":"#282828","bg1":"#3c3836","bg2":"#504945","bg3":"#665c54","bg4":"#7c6f64","border":"#504945","border2":"#665c54","text":"#ebdbb2","text2":"#b8bb26","text3":"#928374"},
  "abyss": {"label":"Abyss","bg0":"#000000","bg1":"#080808","bg2":"#101010","bg3":"#181818","bg4":"#222222","border":"#1a1a1a","border2":"#333333","text":"#cccccc","text2":"#888888","text3":"#555555"},
  "light": {"label":"Light","bg0":"#f5f5f5","bg1":"#ebebeb","bg2":"#e0e0e0","bg3":"#d5d5d5","bg4":"#cacaca","border":"#c0c0c0","border2":"#aaaaaa","text":"#1a1a1a","text2":"#444444","text3":"#888888"},
  "cobalt": {"label":"Cobalt","bg0":"#002240","bg1":"#002b50","bg2":"#003460","bg3":"#003d70","bg4":"#004880","border":"#0050a0","border2":"#1a6ab5","text":"#ffffff","text2":"#80d4ff","text3":"#4488aa"},
  "onedark": {"label":"One Dark","bg0":"#21252b","bg1":"#282c34","bg2":"#2c313c","bg3":"#333842","bg4":"#3b4048","border":"#3e4451","border2":"#5c6370","text":"#abb2bf","text2":"#61afef","text3":"#5c6370"},
  "catppuccin": {"label":"Catppuccin","bg0":"#1e1e2e","bg1":"#181825","bg2":"#313244","bg3":"#45475a","bg4":"#585b70","border":"#45475a","border2":"#585b70","text":"#cdd6f4","text2":"#cba6f7","text3":"#6c7086"},
  "rosepine": {"label":"Rosé Pine","bg0":"#191724","bg1":"#1f1d2e","bg2":"#26233a","bg3":"#2a273f","bg4":"#393552","border":"#393552","border2":"#524f67","text":"#e0def4","text2":"#c4a7e7","text3":"#6e6a86"},
  "tokyonight": {"label":"Tokyo Night","bg0":"#1a1b26","bg1":"#16161e","bg2":"#1f2335","bg3":"#24283b","bg4":"#292e42","border":"#292e42","border2":"#3b4261","text":"#c0caf5","text2":"#7aa2f7","text3":"#565f89"},
  "cyberpunk": {"label":"Cyberpunk","bg0":"#0a0a0f","bg1":"#0f0f18","bg2":"#161622","bg3":"#1e1e2e","bg4":"#28283a","border":"#ff00ff33","border2":"#ff00ff55","text":"#e0e0ff","text2":"#ff00ff","text3":"#8888aa"},
  "matrix": {"label":"Matrix","bg0":"#000000","bg1":"#001100","bg2":"#002200","bg3":"#003300","bg4":"#004400","border":"#005500","border2":"#008800","text":"#00ff00","text2":"#00cc00","text3":"#006600"},
  "ocean": {"label":"Ocean","bg0":"#0d1926","bg1":"#132636","bg2":"#1a3346","bg3":"#214056","bg4":"#284d66","border":"#1e4060","border2":"#2a5a80","text":"#d4e8f8","text2":"#5cacee","text3":"#4a7090"},
  "sunset": {"label":"Sunset","bg0":"#1a0f1e","bg1":"#241528","bg2":"#2e1b32","bg3":"#38213c","bg4":"#422746","border":"#3d2640","border2":"#5a3860","text":"#e8d0e8","text2":"#ff8866","text3":"#8a6080"},
  "blumhouse": {"label":"Blumhouse","bg0":"#0a0000","bg1":"#120000","bg2":"#1a0505","bg3":"#220808","bg4":"#2d0b0b","border":"#3a0a0a","border2":"#551111","text":"#d4b8b8","text2":"#cc0000","text3":"#663333"},
  "scream": {"label":"Scream","bg0":"#000000","bg1":"#08080a","bg2":"#0e0e12","bg3":"#14141a","bg4":"#1c1c24","border":"#222233","border2":"#333355","text":"#e8e8f0","text2":"#f0f0f0","text3":"#555566"},
  "forest": {"label":"🌧 Forest","bg0":"#0a120a","bg1":"#0d170d","bg2":"#111e11","bg3":"#162516","bg4":"#1b2d1b","border":"#1e3a1e","border2":"#2a4a2a","text":"#c8dcc8","text2":"#6abf6a","text3":"#4a7a4a","animation":"rain"},
  "deepspace": {"label":"✦ Deep Space","bg0":"#050510","bg1":"#080818","bg2":"#0c0c22","bg3":"#10102c","bg4":"#161638","border":"#1a1a44","border2":"#2a2a66","text":"#c8d0e8","text2":"#6688cc","text3":"#3a4a70","animation":"deepspace"},
  "snowfall": {"label":"❄ Snowfall","bg0":"#0a1018","bg1":"#0e1520","bg2":"#131c2a","bg3":"#182434","bg4":"#1e2c3e","border":"#243448","border2":"#344860","text":"#e0e8f4","text2":"#88a8cc","text3":"#506880","animation":"snowfall"},
  "fireflies": {"label":"✧ Fireflies","bg0":"#080c06","bg1":"#0c1208","bg2":"#10180c","bg3":"#141e10","bg4":"#1a2616","border":"#1e3018","border2":"#2a4428","text":"#c8d8b8","text2":"#b8cc44","text3":"#5a6a3a","animation":"fireflies"},
  "aurora": {"label":"◌ Aurora","bg0":"#060812","bg1":"#0a0e18","bg2":"#0e1420","bg3":"#121a2a","bg4":"#182234","border":"#1a2844","border2":"#2a3a5a","text":"#d0e0e8","text2":"#44ccaa","text3":"#3a6060","animation":"aurora"},
  "digitalrain": {"label":"⟩ Digital Rain","bg0":"#020604","bg1":"#040a06","bg2":"#061008","bg3":"#08160a","bg4":"#0a1c0e","border":"#0e2812","border2":"#143818","text":"#44dd44","text2":"#22aa22","text3":"#116611","animation":"digitalrain"},
  "neongrid": {"label":"⊞ Neon Grid","bg0":"#08060e","bg1":"#0c0a16","bg2":"#120e1e","bg3":"#181228","bg4":"#1e1832","border":"#281e44","border2":"#382866","text":"#e0d8f0","text2":"#00ccff","text3":"#6644aa","animation":"neongrid"},
  "underwater": {"label":"◎ Underwater","bg0":"#04101a","bg1":"#061620","bg2":"#081c28","bg3":"#0a2430","bg4":"#0e2c3a","border":"#103848","border2":"#1a4c60","text":"#b8d8e8","text2":"#44aabb","text3":"#2a6678","animation":"underwater"},
  "cherryblossom": {"label":"✿ Blossom","bg0":"#100a0e","bg1":"#161012","bg2":"#1c1618","bg3":"#241c20","bg4":"#2c2228","border":"#382a30","border2":"#4a3a44","text":"#e8d8dc","text2":"#e888a0","text3":"#886068","animation":"cherryblossom"},
  "starwarp": {"label":"⋆ Starfield","bg0":"#000004","bg1":"#04040c","bg2":"#080814","bg3":"#0c0c1e","bg4":"#121228","border":"#1a1a38","border2":"#2a2a50","text":"#d0d0e8","text2":"#8888cc","text3":"#4a4a78","animation":"starwarp"},
  "ember": {"label":"⊙ Ember","bg0":"#100804","bg1":"#180e06","bg2":"#201408","bg3":"#281a0c","bg4":"#322010","border":"#3a2814","border2":"#503820","text":"#e8d0b8","text2":"#ee8833","text3":"#886030","animation":"ember"},
  "nebula": {"label":"☁ Nebula","bg0":"#0a0610","bg1":"#0e0a18","bg2":"#140e22","bg3":"#1a122c","bg4":"#201838","border":"#281e48","border2":"#382a60","text":"#d8c8e8","text2":"#aa66ee","text3":"#6644aa","animation":"nebula"},
  "confetti": {"label":"◈ Confetti","bg0":"#0e0e12","bg1":"#14141a","bg2":"#1a1a22","bg3":"#20202c","bg4":"#282836","border":"#303044","border2":"#404060","text":"#e8e8f0","text2":"#ff8844","text3":"#666680","animation":"confetti"},
  "campfire": {"label":"♨ Campfire","bg0":"#0e0804","bg1":"#140c06","bg2":"#1a1208","bg3":"#22180c","bg4":"#2a1e10","border":"#342816","border2":"#483820","text":"#e0d0b0","text2":"#ee9944","text3":"#806830","animation":"campfire"},
  "oceanwaves": {"label":"≈ Ocean Waves","bg0":"#04101c","bg1":"#061624","bg2":"#081e2e","bg3":"#0c2638","bg4":"#102e42","border":"#163a50","border2":"#204c66","text":"#c0d8e8","text2":"#3399cc","text3":"#2a6688","animation":"oceanwaves"},
  "plasma": {"label":"◉ Plasma","bg0":"#0a0810","bg1":"#100c18","bg2":"#161020","bg3":"#1c142a","bg4":"#241a34","border":"#2c2040","border2":"#3c2c58","text":"#d8d0e8","text2":"#cc66ff","text3":"#7744aa","animation":"plasma"},
  "oceandeep": {"label":"Ocean Deep","bg0":"#040e16","bg1":"#061420","bg2":"#081a2a","bg3":"#0c2234","bg4":"#102a3e","border":"#143650","border2":"#1e4a68","text":"#b0d0e4","text2":"#2288bb","text3":"#1a5a7a"},
  "neontokyo": {"label":"Neon Tokyo","bg0":"#0c0814","bg1":"#120c1c","bg2":"#181024","bg3":"#1e142e","bg4":"#261a38","border":"#302044","border2":"#442e60","text":"#e0d0f0","text2":"#ff3388","text3":"#8844aa"},
  "vaporwave": {"label":"Vaporwave","bg0":"#1a0e24","bg1":"#221434","bg2":"#2a1a40","bg3":"#32204c","bg4":"#3a2658","border":"#442e66","border2":"#5a3e80","text":"#e8d0ff","text2":"#ff71ce","text3":"#8a58aa"},
  "bloodmoon": {"label":"Blood Moon","bg0":"#100404","bg1":"#180606","bg2":"#200a0a","bg3":"#2a0e0e","bg4":"#341212","border":"#401818","border2":"#582424","text":"#e0b8b8","text2":"#dd2222","text3":"#883030"},
  "arctic": {"label":"Arctic","bg0":"#0c1218","bg1":"#101820","bg2":"#141e28","bg3":"#1a2632","bg4":"#202e3c","border":"#283a4c","border2":"#384e64","text":"#e4eef4","text2":"#66bbdd","text3":"#4a7a90"},
  "goldenhour": {"label":"Golden Hour","bg0":"#141008","bg1":"#1a1610","bg2":"#221c14","bg3":"#2a2218","bg4":"#342a1e","border":"#3e3424","border2":"#584a34","text":"#e8dcc0","text2":"#ddaa44","text3":"#887040"},
  "midnightpurple": {"label":"Midnight Purple","bg0":"#0a0612","bg1":"#0e0a1a","bg2":"#140e24","bg3":"#1a1230","bg4":"#20183c","border":"#281e4c","border2":"#382a66","text":"#d0c0e8","text2":"#9966ff","text3":"#5a3aaa"},
  "termgreen": {"label":"Terminal Green","bg0":"#040804","bg1":"#060c06","bg2":"#081208","bg3":"#0c180c","bg4":"#0e1e0e","border":"#142814","border2":"#1e381e","text":"#88ee88","text2":"#44bb44","text3":"#227722"},
  "neonmint": {"label":"Neon Mint","bg0":"#060e0e","bg1":"#0a1414","bg2":"#0e1a1a","bg3":"#122222","bg4":"#182a2a","border":"#1e3636","border2":"#2a4a4a","text":"#c8f0e8","text2":"#00eebb","text3":"#337766"},
  "stealth": {"label":"Stealth","bg0":"#0e0e0e","bg1":"#141414","bg2":"#1a1a1a","bg3":"#222222","bg4":"#2a2a2a","border":"#333333","border2":"#444444","text":"#aaaaaa","text2":"#777777","text3":"#505050"},
  "lava": {"label":"Lava","bg0":"#120400","bg1":"#1a0800","bg2":"#220c00","bg3":"#2c1000","bg4":"#361400","border":"#441a00","border2":"#602800","text":"#e8c8a0","text2":"#ff6600","text3":"#884400"},
  "frost": {"label":"Frost","bg0":"#0a1020","bg1":"#0e1628","bg2":"#121c32","bg3":"#18243c","bg4":"#1e2c48","border":"#243658","border2":"#304870","text":"#d8e8f8","text2":"#88ccff","text3":"#4a7aaa"},
  "cyberdeck": {"label":"Cyberdeck","bg0":"#0a0a10","bg1":"#0e0e18","bg2":"#141420","bg3":"#1a1a2a","bg4":"#222234","border":"#2a2a44","border2":"#3a3a5c","text":"#c8c8e0","text2":"#00ff88","text3":"#4a4a6a"},
  "phantom": {"label":"Phantom","bg0":"#08080c","bg1":"#0e0e14","bg2":"#14141c","bg3":"#1a1a26","bg4":"#222230","border":"#2a2a3c","border2":"#3c3c52","text":"#c0c0d0","text2":"#8888aa","text3":"#505068"},
  "hacker": {"label":"Hacker","bg0":"#000000","bg1":"#060606","bg2":"#0c0c0c","bg3":"#141414","bg4":"#1c1c1c","border":"#262626","border2":"#383838","text":"#33ff33","text2":"#22cc22","text3":"#0f7a0f"},
  "coffee": {"label":"Coffee","bg0":"#120e08","bg1":"#181410","bg2":"#1e1a14","bg3":"#262018","bg4":"#2e281e","border":"#383026","border2":"#4a4234","text":"#d8ccb0","text2":"#b8884a","text3":"#7a6040"},
  "emerald": {"label":"Emerald","bg0":"#040e08","bg1":"#061410","bg2":"#081a14","bg3":"#0c221a","bg4":"#102a20","border":"#143628","border2":"#1e4a3a","text":"#b8e8cc","text2":"#22cc66","text3":"#1a7a44"},
  "ruby": {"label":"Ruby","bg0":"#100408","bg1":"#18060c","bg2":"#200a12","bg3":"#280e18","bg4":"#32121e","border":"#3e1a28","border2":"#582438","text":"#e8c0cc","text2":"#dd2255","text3":"#883050"},
  "sapphire": {"label":"Sapphire","bg0":"#040810","bg1":"#060e18","bg2":"#081420","bg3":"#0c1a2a","bg4":"#102034","border":"#142a44","border2":"#1e3a5c","text":"#c0d0e8","text2":"#2266ee","text3":"#1a4a8a"},
  "amethyst": {"label":"Amethyst","bg0":"#0c0610","bg1":"#120a18","bg2":"#180e22","bg3":"#1e122c","bg4":"#261838","border":"#301e48","border2":"#442a60","text":"#d8c0e8","text2":"#8833dd","text3":"#5a2a88"},
  "coral": {"label":"Coral","bg0":"#120808","bg1":"#1a0e0e","bg2":"#221414","bg3":"#2a1a1a","bg4":"#342222","border":"#3e2a2a","border2":"#543c3c","text":"#e8d0c8","text2":"#ff6655","text3":"#885050"},
  "obsidian": {"label":"Obsidian","bg0":"#080808","bg1":"#0e0e10","bg2":"#141418","bg3":"#1a1a20","bg4":"#22222a","border":"#2a2a34","border2":"#3a3a48","text":"#b8b8c8","text2":"#6666aa","text3":"#444466"},
  "rosegold": {"label":"Rose Gold","bg0":"#120c0c","bg1":"#1a1212","bg2":"#221818","bg3":"#2a1e1e","bg4":"#342626","border":"#3e2e2e","border2":"#544040","text":"#e8d4cc","text2":"#dd8877","text3":"#886058"},
  "retroterminal": {"label":"Retro Terminal","bg0":"#001000","bg1":"#001800","bg2":"#002200","bg3":"#002c00","bg4":"#003600","border":"#004400","border2":"#005e00","text":"#33ff00","text2":"#28cc00","text3":"#167700"},
  "bladerunner": {"label":"Blade Runner","bg0":"#0a0810","bg1":"#100c18","bg2":"#161020","bg3":"#1c1428","bg4":"#241a32","border":"#2c2040","border2":"#3c2c58","text":"#d8c8d4","text2":"#ee6644","text3":"#7a5060"},
  "outrun": {"label":"Outrun","bg0":"#0c0418","bg1":"#120620","bg2":"#1a082c","bg3":"#220a38","bg4":"#2a0e44","border":"#341258","border2":"#441a70","text":"#e0c0ff","text2":"#ff2299","text3":"#8844aa"},
  "hotlinemiami": {"label":"Hotline Miami","bg0":"#1a0c14","bg1":"#22101c","bg2":"#2a1424","bg3":"#34182e","bg4":"#3e1c38","border":"#4a2444","border2":"#603060","text":"#f0d0e0","text2":"#ff4488","text3":"#aa4480"},
  "lofi": {"label":"Lo-fi","bg0":"#14120e","bg1":"#1c1a14","bg2":"#24221a","bg3":"#2c2a22","bg4":"#363228","border":"#403a30","border2":"#584e44","text":"#d8d0c0","text2":"#aaaa66","text3":"#706a50"},
  "darkwave": {"label":"Darkwave","bg0":"#06060e","bg1":"#0a0a16","bg2":"#0e0e1e","bg3":"#141428","bg4":"#1a1a32","border":"#222240","border2":"#303058","text":"#c0c0e0","text2":"#6666dd","text3":"#3a3a88"},
  "copper": {"label":"Copper","bg0":"#100a06","bg1":"#180e08","bg2":"#20140c","bg3":"#281a10","bg4":"#302014","border":"#3a281a","border2":"#503824","text":"#e0ccb0","text2":"#cc8844","text3":"#886038"},
  "slate": {"label":"Slate","bg0":"#0e1014","bg1":"#14181c","bg2":"#1a1e24","bg3":"#20262e","bg4":"#282e38","border":"#303844","border2":"#404c5c","text":"#c8d0d8","text2":"#7088a0","text3":"#4a5a6c"},
  "charcoal": {"label":"Charcoal","bg0":"#101010","bg1":"#161616","bg2":"#1c1c1c","bg3":"#242424","bg4":"#2c2c2c","border":"#363636","border2":"#484848","text":"#c8c8c8","text2":"#888888","text3":"#585858"},
  "graphite": {"label":"Graphite","bg0":"#0c0e10","bg1":"#121416","bg2":"#181a1e","bg3":"#1e2226","bg4":"#262a2e","border":"#2e3438","border2":"#3e4448","text":"#c0c8cc","text2":"#6a7a84","text3":"#4a5660"},
  "indigonight": {"label":"Indigo Night","bg0":"#080614","bg1":"#0c0a1c","bg2":"#120e26","bg3":"#181230","bg4":"#1e183c","border":"#261e4c","border2":"#342a64","text":"#c8c0e0","text2":"#5544ee","text3":"#3a2aaa"},
  "twilight": {"label":"Twilight","bg0":"#0e0a14","bg1":"#14101c","bg2":"#1a1624","bg3":"#221c2e","bg4":"#2a2238","border":"#322a44","border2":"#44385c","text":"#d8cce0","text2":"#cc7788","text3":"#7a5068"},
  "alien": {"label":"👽 Alien","bg0":"#020808","bg1":"#041010","bg2":"#061818","bg3":"#082020","bg4":"#0c2c2c","border":"#0e3a2a","border2":"#145038","text":"#88ffcc","text2":"#44ee88","text3":"#227744","animation":"alien"},
  "lightning": {"label":"⚡ Lightning","bg0":"#0a0a14","bg1":"#0e0e1c","bg2":"#141424","bg3":"#1a1a2e","bg4":"#202038","border":"#282844","border2":"#383866","text":"#d0d0e0","text2":"#aaaaff","text3":"#5555aa","animation":"lightning"},
  "sandstorm": {"label":"🏜 Sandstorm","bg0":"#141008","bg1":"#1c1610","bg2":"#241e16","bg3":"#2c261e","bg4":"#362e24","border":"#40382c","border2":"#584c3c","text":"#e0d8c4","text2":"#ccaa66","text3":"#887044","animation":"sandstorm"},
  "hologram": {"label":"◇ Hologram","bg0":"#040810","bg1":"#061018","bg2":"#081820","bg3":"#0c202a","bg4":"#102834","border":"#143444","border2":"#1e4860","text":"#c0e8f0","text2":"#00eeff","text3":"#2a7788","animation":"hologram"},
  "meteorshower": {"label":"☄ Meteors","bg0":"#06040e","bg1":"#0a0816","bg2":"#0e0c1e","bg3":"#141028","bg4":"#1a1432","border":"#221a40","border2":"#302660","text":"#d4c8e8","text2":"#ff8844","text3":"#6644aa","animation":"meteorshower"},
  "pixelrain": {"label":"▦ Pixel Rain","bg0":"#040604","bg1":"#080c08","bg2":"#0c120c","bg3":"#101810","bg4":"#141e14","border":"#1a281a","border2":"#223822","text":"#b0e0b0","text2":"#44dd88","text3":"#226640","animation":"pixelrain"},
  "synthsun": {"label":"▽ Synthwave","bg0":"#0e041a","bg1":"#140822","bg2":"#1c0c2c","bg3":"#241038","bg4":"#2c1444","border":"#381c58","border2":"#4a2870","text":"#e0c0f0","text2":"#ff44aa","text3":"#8844aa","animation":"synthsun"},
  "toxicrain": {"label":"☢ Toxic Rain","bg0":"#040804","bg1":"#080e08","bg2":"#0c140c","bg3":"#101c10","bg4":"#142414","border":"#1a3018","border2":"#244420","text":"#c0e8b0","text2":"#66ff22","text3":"#338822","animation":"toxicrain"},
  "fairydust": {"label":"✦ Fairy Dust","bg0":"#0c0a12","bg1":"#12101a","bg2":"#181622","bg3":"#1e1c2c","bg4":"#262236","border":"#302a44","border2":"#403a5c","text":"#d8d0e8","text2":"#eebb44","text3":"#7a6888","animation":"fairydust"},
  "comettrail": {"label":"☆ Comets","bg0":"#040610","bg1":"#060a18","bg2":"#0a0e22","bg3":"#0e142c","bg4":"#141a38","border":"#1a2248","border2":"#243260","text":"#c8d4f0","text2":"#88bbff","text3":"#4466aa","animation":"comettrail"},
  "lavalamp": {"label":"● Lava Lamp","bg0":"#100804","bg1":"#180c06","bg2":"#201208","bg3":"#28180c","bg4":"#301e10","border":"#3c2816","border2":"#503820","text":"#e8d0b0","text2":"#ff6622","text3":"#884422","animation":"lavalamp"},
  "electricarc": {"label":"϶ Electric","bg0":"#04060e","bg1":"#060a16","bg2":"#080e20","bg3":"#0c122a","bg4":"#101834","border":"#142044","border2":"#1c2e5c","text":"#c0d0f0","text2":"#44aaff","text3":"#2266aa","animation":"electricarc"},
  "galaxy": {"label":"☊ Galaxy","bg0":"#080410","bg1":"#0c0818","bg2":"#120c22","bg3":"#18102e","bg4":"#1e163a","border":"#281e4c","border2":"#342a66","text":"#d0c4e8","text2":"#bb66ff","text3":"#6644aa","animation":"galaxy"},
  "glitch": {"label":"▣ Glitch","bg0":"#0a0a0e","bg1":"#101016","bg2":"#16161e","bg3":"#1c1c28","bg4":"#242432","border":"#2c2c40","border2":"#3c3c58","text":"#d0d0e0","text2":"#ff4466","text3":"#5555aa","animation":"glitch"},
  "firewall": {"label":"⧫ Firewall","bg0":"#0c0804","bg1":"#120e08","bg2":"#18140c","bg3":"#201a10","bg4":"#282016","border":"#342a1c","border2":"#483c2c","text":"#e0d4b8","text2":"#ff8800","text3":"#886622","animation":"firewall"},
  "northern": {"label":"❂ Northern","bg0":"#040810","bg1":"#060e18","bg2":"#0a1420","bg3":"#0e1a2a","bg4":"#142234","border":"#1a2c44","border2":"#243e5c","text":"#c8e0f0","text2":"#44ddaa","text3":"#2a7060","animation":"northern"},
  "pumpkin": {"label":"Pumpkin Spice","bg0":"#141006","bg1":"#1c160a","bg2":"#241e0e","bg3":"#2e2614","bg4":"#382e1a","border":"#443822","border2":"#5c4c30","text":"#e8d8b8","text2":"#ee8822","text3":"#886620"},
  "deepsea": {"label":"Deep Sea","bg0":"#020c14","bg1":"#04121c","bg2":"#061a26","bg3":"#0a2230","bg4":"#0e2a3c","border":"#123650","border2":"#1a4a68","text":"#a8d0e8","text2":"#1188cc","text3":"#0a5a88"},
  "neonblue": {"label":"Neon Blue","bg0":"#04040e","bg1":"#080816","bg2":"#0c0c20","bg3":"#10102a","bg4":"#161636","border":"#1c1c48","border2":"#2a2a66","text":"#c8c8f0","text2":"#4488ff","text3":"#2244bb"},
  "bubblegum": {"label":"Bubblegum","bg0":"#120810","bg1":"#1a0e18","bg2":"#221420","bg3":"#2c1a2a","bg4":"#362234","border":"#422a40","border2":"#5a3c58","text":"#f0d0e8","text2":"#ff66aa","text3":"#aa4488"},
  "volcanic": {"label":"Volcanic","bg0":"#100400","bg1":"#1a0800","bg2":"#240e00","bg3":"#301400","bg4":"#3c1a00","border":"#4c2200","border2":"#663400","text":"#e8c8a0","text2":"#ff4400","text3":"#aa3300"},
  "pineforest": {"label":"Pine Forest","bg0":"#060c08","bg1":"#0a1410","bg2":"#0e1c16","bg3":"#12241c","bg4":"#182c22","border":"#1e382c","border2":"#2a4c3c","text":"#c0dcc8","text2":"#44aa66","text3":"#2a6a40"},
  "burgundy": {"label":"Burgundy","bg0":"#100408","bg1":"#18080e","bg2":"#220c14","bg3":"#2c101a","bg4":"#361420","border":"#441a28","border2":"#5c2438","text":"#e8c8d0","text2":"#cc2244","text3":"#882244"},
  "teal": {"label":"Teal","bg0":"#040c0c","bg1":"#081414","bg2":"#0c1c1c","bg3":"#102424","bg4":"#142e2e","border":"#1a3a3a","border2":"#244e4e","text":"#c0e8e4","text2":"#22bbaa","text3":"#1a7a70"},
  "solarflare": {"label":"Solar Flare","bg0":"#120804","bg1":"#1c0e08","bg2":"#28140c","bg3":"#341a10","bg4":"#402014","border":"#4e2a1a","border2":"#663c24","text":"#e8d4b8","text2":"#ffaa22","text3":"#aa6a22"},
  "winterfell": {"label":"Winterfell","bg0":"#0a0e14","bg1":"#10161e","bg2":"#141e28","bg3":"#1a2632","bg4":"#202e3c","border":"#283a4c","border2":"#384e64","text":"#dce8f4","text2":"#88aacc","text3":"#4a6a88"},
  "sakura": {"label":"Sakura","bg0":"#120a0c","bg1":"#1a1014","bg2":"#22161c","bg3":"#2a1c24","bg4":"#34222c","border":"#402a34","border2":"#583c48","text":"#f0d8dc","text2":"#ee6688","text3":"#aa5068"},
  "cybernetic": {"label":"Cybernetic","bg0":"#060808","bg1":"#0c1010","bg2":"#121818","bg3":"#182020","bg4":"#1e2a2a","border":"#263636","border2":"#344a4a","text":"#c8e0dc","text2":"#00ddcc","text3":"#228878"},
  "desert": {"label":"Desert","bg0":"#14100a","bg1":"#1c1810","bg2":"#261e16","bg3":"#30261c","bg4":"#3a2e22","border":"#463828","border2":"#5e4c38","text":"#e4d8c0","text2":"#cc9944","text3":"#887040"},
  "ivory": {"label":"Ivory Tower","bg0":"#f0ece4","bg1":"#e8e4dc","bg2":"#dedad0","bg3":"#d4d0c6","bg4":"#c8c4b8","border":"#b8b4a8","border2":"#a0a090","text":"#2a2820","text2":"#605848","text3":"#908878"},
  "noir": {"label":"Noir","bg0":"#050505","bg1":"#0a0a0a","bg2":"#111111","bg3":"#181818","bg4":"#202020","border":"#2a2a2a","border2":"#3a3a3a","text":"#c0c0c0","text2":"#808080","text3":"#484848"},
  "spearmint": {"label":"Spearmint","bg0":"#06100c","bg1":"#0a1812","bg2":"#0e2018","bg3":"#12281e","bg4":"#183226","border":"#1e3e30","border2":"#2a5444","text":"#c4e8d8","text2":"#44cc88","text3":"#2a8858"},
  "ultraviolet": {"label":"Ultraviolet","bg0":"#0a0414","bg1":"#10081c","bg2":"#180c28","bg3":"#201034","bg4":"#281640","border":"#321e54","border2":"#442a70","text":"#d4c0f0","text2":"#aa44ff","text3":"#6a2aaa"},
  "warmgray": {"label":"Warm Gray","bg0":"#121010","bg1":"#1a1616","bg2":"#221e1e","bg3":"#2a2626","bg4":"#342e2e","border":"#3e3838","border2":"#524c4c","text":"#d0c8c8","text2":"#a09090","text3":"#686060"},
  "wine": {"label":"Wine","bg0":"#100608","bg1":"#180a0e","bg2":"#200e14","bg3":"#28121a","bg4":"#321620","border":"#3e1c28","border2":"#562838","text":"#e4c8cc","text2":"#bb3355","text3":"#883344"},
  "zinc": {"label":"Zinc","bg0":"#0c0e10","bg1":"#121416","bg2":"#181c1e","bg3":"#202426","bg4":"#282c2e","border":"#323638","border2":"#444a4c","text":"#c8ccce","text2":"#7a8488","text3":"#505860"},
  "petrol": {"label":"Petrol","bg0":"#060a0e","bg1":"#0a1014","bg2":"#0e161c","bg3":"#141e26","bg4":"#1a2630","border":"#203040","border2":"#2c4258","text":"#b8d0dc","text2":"#3388aa","text3":"#1a5a78"},
  "oxide": {"label":"Oxide","bg0":"#0e0808","bg1":"#160e0c","bg2":"#1e1410","bg3":"#281a14","bg4":"#32201a","border":"#3e2a22","border2":"#543a30","text":"#dcc8b8","text2":"#cc6633","text3":"#884830"},
  "candy": {"label":"Candy","bg0":"#100810","bg1":"#180e18","bg2":"#201420","bg3":"#2a1a2a","bg4":"#342234","border":"#402a40","border2":"#583c58","text":"#f0d0f0","text2":"#ee44cc","text3":"#aa3388"},
  "dusk": {"label":"Dusk","bg0":"#0c0810","bg1":"#140e18","bg2":"#1c1420","bg3":"#241a2a","bg4":"#2e2234","border":"#382a40","border2":"#4c3c58","text":"#dcd0e4","text2":"#aa88cc","text3":"#6a5088"},
  "sepia": {"label":"Sepia","bg0":"#12100a","bg1":"#1a1610","bg2":"#221e16","bg3":"#2c261e","bg4":"#362e24","border":"#40382c","border2":"#584e3c","text":"#dcd4c0","text2":"#aa8844","text3":"#786038"},
  "mango": {"label":"Mango","bg0":"#140e04","bg1":"#1c1408","bg2":"#261c0c","bg3":"#302410","bg4":"#3c2c16","border":"#48361c","border2":"#604a28","text":"#e8dcc0","text2":"#ffaa00","text3":"#aa7400"},
  "wasabi": {"label":"Wasabi","bg0":"#080c04","bg1":"#0e1408","bg2":"#141c0c","bg3":"#1a2410","bg4":"#202e16","border":"#283a1e","border2":"#364e2a","text":"#d0e0b8","text2":"#88cc22","text3":"#5a8820"},
  "ash": {"label":"Ash","bg0":"#0e0e0c","bg1":"#141412","bg2":"#1c1c18","bg3":"#24241e","bg4":"#2c2c26","border":"#363630","border2":"#4a4a40","text":"#c8c8c0","text2":"#8a8a78","text3":"#5c5c50"},
  "mauve": {"label":"Mauve","bg0":"#0e0a10","bg1":"#141018","bg2":"#1c1620","bg3":"#241e2a","bg4":"#2c2634","border":"#342e40","border2":"#48405a","text":"#dcd0e0","text2":"#bb88cc","text3":"#7a5a88"},
  "tundra": {"label":"Tundra","bg0":"#0a0c10","bg1":"#101418","bg2":"#161c22","bg3":"#1e242c","bg4":"#262e36","border":"#303a46","border2":"#404e5e","text":"#d0d8e0","text2":"#7898b0","text3":"#4a6478"},
  "verdant": {"label":"Verdant","bg0":"#040a06","bg1":"#081208","bg2":"#0c1a0e","bg3":"#102214","bg4":"#162a1a","border":"#1c3622","border2":"#284a30","text":"#c0dcc4","text2":"#22bb44","text3":"#1a7a30"},
  "salmon": {"label":"Salmon","bg0":"#120a08","bg1":"#1a100e","bg2":"#221614","bg3":"#2a1c1a","bg4":"#342422","border":"#3e2c2a","border2":"#543e3a","text":"#e8d4cc","text2":"#ee7766","text3":"#aa5a50"},
  "storm": {"label":"Storm","bg0":"#08080e","bg1":"#0e0e16","bg2":"#14141e","bg3":"#1a1a28","bg4":"#222232","border":"#2a2a3e","border2":"#3a3a56","text":"#c8c8d8","text2":"#6688bb","text3":"#445880"},
  "glacier": {"label":"Glacier","bg0":"#081014","bg1":"#0e181e","bg2":"#142028","bg3":"#1a2832","bg4":"#22323e","border":"#2a3e4e","border2":"#385266","text":"#d4e4f0","text2":"#66aadd","text3":"#3a7098"},
  "sunflower": {"label":"Sunflower","bg0":"#121004","bg1":"#1a1808","bg2":"#24200c","bg3":"#2e2810","bg4":"#383016","border":"#443a1e","border2":"#5c4e2a","text":"#e8e0c0","text2":"#eecc00","text3":"#aa8c00"},
};

function themeVariant(background: string): 'light' | 'dark' {
  const normalized = background.replace('#', '');
  if (normalized.length !== 6) return 'dark';
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.62 ? 'light' : 'dark';
}

function hexToRgbString(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function createLegacyTheme(id: string, def: LegacyThemeDefinition): Theme {
  const variant = themeVariant(def.bg0);
  const isLight = variant === 'light';
  const customCSS = [
    ':root[data-theme-id="' + id + '"] body {',
    '  background:',
    '    radial-gradient(circle at top, ' + hexToRgbString(def.text2, isLight ? 0.08 : 0.12) + ' 0%, transparent 34%),',
    '    linear-gradient(180deg, ' + def.bg1 + ' 0%, ' + def.bg0 + ' 100%);',
    '}',
    '',
    ':root[data-theme-id="' + id + '"] .glass-panel-light,',
    ':root[data-theme-id="' + id + '"] .glass-panel,',
    ':root[data-theme-id="' + id + '"] .glass-card-enhanced {',
    '  background: ' + hexToRgbString(def.bg2, isLight ? 0.9 : 0.72) + ';',
    '  border-color: ' + def.border + ';',
    '  box-shadow: 0 18px 50px rgba(0, 0, 0, ' + (isLight ? 0.08 : 0.26) + ');',
    '}',
    '',
    ':root[data-theme-id="' + id + '"] .bg-cream {',
    '  background:',
    '    radial-gradient(circle at top left, ' + hexToRgbString(def.text2, isLight ? 0.06 : 0.11) + ' 0%, transparent 26%),',
    '    linear-gradient(180deg, ' + def.bg1 + ' 0%, ' + def.bg0 + ' 100%);',
    '}',
    '',
    ':root[data-theme-id="' + id + '"] .sidebar-item-active,',
    ':root[data-theme-id="' + id + '"] .tab-button-active {',
    '  background: linear-gradient(135deg, ' + hexToRgbString(def.text2, isLight ? 0.16 : 0.2) + ' 0%, ' + hexToRgbString(def.border2, isLight ? 0.16 : 0.22) + ' 100%);',
    '  border-color: ' + def.text2 + ';',
    '}',
    ...(def.animation ? [
      '',
      ':root[data-theme-id="' + id + '"] .app-shell,',
      ':root[data-theme-id="' + id + '"] .main-content,',
      ':root[data-theme-id="' + id + '"] .bg-cream {',
      '  background: transparent !important;',
      '}',
      '',
      ':root[data-theme-id="' + id + '"] .bg-card,',
      ':root[data-theme-id="' + id + '"] .bg-background,',
      ':root[data-theme-id="' + id + '"] .glass-panel,',
      ':root[data-theme-id="' + id + '"] .glass-panel-light,',
      ':root[data-theme-id="' + id + '"] .glass-panel-heavy {',
      '  background-color: ' + hexToRgbString(def.bg2, isLight ? 0.78 : 0.62) + ' !important;',
      '  border-color: ' + hexToRgbString(def.border2, isLight ? 0.55 : 0.72) + ' !important;',
      '}',
      '',
      ':root[data-theme-id="' + id + '"] .bg-muted {',
      '  background-color: ' + hexToRgbString(def.bg3, isLight ? 0.72 : 0.5) + ' !important;',
      '}',
    ] : []),
  ].join('\n');

  return {
    id,
    name: def.label.replace(/^[^\wA-Za-z]+\s*/u, ''),
    variant,
    description: def.animation
      ? 'Legacy browser theme with lightweight animated backdrop.'
      : 'Legacy browser theme imported from the original theme catalog.',
    colors: {
      background: def.bg0,
      onBackground: def.text,
      surface: def.bg1,
      onSurface: def.text,
      surfaceVariant: def.bg2,
      primary: def.text2,
      onPrimary: isLight ? '#ffffff' : '#05070b',
      primaryContainer: def.bg3,
      onPrimaryContainer: def.text,
      secondary: def.border2,
      onSecondary: def.text,
      outline: def.border,
      outlineVariant: def.border2,
      error: '#ff5c7a',
      onError: '#ffffff',
      errorContainer: isLight ? '#ffd7de' : '#4a1522',
      onErrorContainer: isLight ? '#5f1020' : '#ffd7de',
      success: isLight ? '#127c52' : '#44d19e',
      warning: isLight ? '#9b6b00' : '#ffcf66',
      toolbar: def.bg1,
      sidebar: def.bg2,
      card: hexToRgbString(def.bg2, isLight ? 0.9 : 0.82),
      input: def.bg3,
      border: def.border,
      text: def.text,
      textSecondary: def.text3,
      link: def.text2,
    },
    typography: {
      fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
      },
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      lineHeight: {
        tight: 1.25,
        normal: 1.55,
        relaxed: 1.75,
      },
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
    },
    radius: {
      none: '0',
      sm: '0.2rem',
      md: '0.45rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.25rem',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgb(0 0 0 / 0.15)',
      md: '0 10px 24px rgb(0 0 0 / 0.18)',
      lg: '0 18px 50px rgb(0 0 0 / 0.24)',
      xl: '0 26px 80px rgb(0 0 0 / 0.28)',
    },
    effects: def.animation ? { backgroundAnimation: def.animation } : undefined,
    customCSS,
  };
}

export const legacyIndexThemes: Theme[] = Object.entries(legacyThemeDefinitions).map(([id, def]) => createLegacyTheme(id, def));
export const legacyIndexThemeIds = legacyIndexThemes.map((theme) => theme.id);
