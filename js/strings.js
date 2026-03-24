// ── Internationalisation ────────────────────────────────────────────────────
// Detect browser language once; can be overridden at runtime via window._gameLang
window._gameLang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';

function t(key) {
  const lang = window._gameLang;
  return (STRINGS[lang] && STRINGS[lang][key] !== undefined)
    ? STRINGS[lang][key]
    : (STRINGS['en'][key] !== undefined ? STRINGS['en'][key] : key);
}

const STRINGS = {
  en: {
    // TitleScene
    tagline:  'Rise your community, regenerate resources',
    story:    'Through human actions, particularly those of the most greedy, the planet has been turned into a vast desert. Years later, communities are trying to establish themselves by managing resources more effectively and respecting planetary boundaries.',
    play_btn: 'CREATE MY COMMUNITY',
    lang_btn: 'Passer en français',

    // HUD buttons
    btn_build:    'BUILD',
    btn_farm:     'FARM',
    btn_plant:    'PLANT TREE',
    btn_journal:  'JOURNAL',
    btn_settings: 'SETTINGS',
    btn_picture:  'TAKE A PICTURE',
    wood_unit:    'wood',
    hud_land:     'Land health',
    hud_water:    'Water',
    hud_community:'Community',

    // Settings
    settings_title:       'SETTINGS',
    settings_music:       'MUSIC',
    settings_sfx:         'SOUND FX',
    settings_lang:        'LANGUAGE',
    settings_lang_toggle: 'FR',
    settings_on:          'ON',
    settings_off:         'OFF',
    settings_close:       'CLOSE',

    // Journal
    journal_title: 'JOURNAL',
    journal_empty: 'No events yet.',
    journal_close: 'CLOSE',

    // Alert / Game Over
    ok:            'OK',
    game_over_land:  "Game Over!\nThe land health has collapsed.",
    game_over_water: "Game Over!\nThe region is experiencing\na water crisis.",
    replay:        'REPLAY',

    // In-game alerts
    alert_start:          'To build a shelter, cut at least 5 trees.\nYou can click and hold to cut multiple trees at once.',
    alert_wood_ready:     'Now that you have 5 pieces of wood, you can build your shelter.\nClick where you want to place your shelter.',
    alert_shelter_built:  'Now that you have a shelter, you need to grow food for your community.\nClick on the Farm button then place a farmland wherever you want.',
    alert_farm_limit:     'The number of farmland depends on your community size.\nBuild more shelters to welcome more people.',
    alert_garden_ready:   'Your first garden is ready!\nClick quickly to harvest before the produce goes off.',
    alert_garden_harvest: 'Harvesting provides food and wood, and helps the population to grow.\nNow, you can replant in the same place where you harvested.\nYou can also expand your community by building other shelters.\nPay attention to the damage you cause on the land health and on the water level.',
    alert_water_reforest: 'Water level is dropping.\nPlanting trees helps preserve water resources.\nUse the "Plant Tree" button!',
    alert_land_critical:  'Alert! Land health is critical.',
    alert_water_low:      'Alert! Water level is critical.\nPlant trees to slow the decline.',
    alert_water_crisis:   'Warning: your community is facing a serious ecological crisis.\nIt is urgent to regenerate the forest and preserve water resources.',
    alert_build_limit:    'You need at least one farmland per shelter.\nCreate more gardens before building a new shelter.',
    alert_picture_saved:  'A memory has been saved on your computer!',
    alert_all_full:       'Well done, you have built a sustainable community.\nBut nothing is guaranteed, keep preserving resources.',
  },

  fr: {
    // TitleScene
    tagline:  'Développez votre communauté, régénérez les ressources',
    story:    "À cause des activités des humains, notamment celles des plus cupides, la planète a été transformée en un vaste désert. Des années plus tard, des communautés tentent de s'établir en utilisant mieux les ressources et en respectant les limites planétaires.",
    play_btn: 'CRÉER MA COMMUNAUTÉ',
    lang_btn: 'Switch to English',

    // HUD buttons
    btn_build:    'CONSTRUIRE',
    btn_farm:     'PLANTER',
    btn_plant:    'PLANTER ARBRE',
    btn_journal:  'JOURNAL',
    btn_settings: 'OPTIONS',
    btn_picture:  'PRENDRE UNE PHOTO',
    wood_unit:    'bois',
    hud_land:     'Santé des sols',
    hud_water:    'Eau',
    hud_community:'Communauté',

    // Settings
    settings_title:       'OPTIONS',
    settings_music:       'MUSIQUE',
    settings_sfx:         'EFFETS SONORES',
    settings_lang:        'LANGUE',
    settings_lang_toggle: 'EN',
    settings_on:          'OUI',
    settings_off:         'NON',
    settings_close:       'FERMER',

    // Journal
    journal_title: 'JOURNAL',
    journal_empty: 'Aucun événement.',
    journal_close: 'FERMER',

    // Alert / Game Over
    ok:            'OK',
    game_over_land:  "Partie terminée !\nLa santé des sols s'est effondrée.",
    game_over_water: "Partie terminée !\nLa région traverse\nune crise de l'eau.",
    replay:        'REJOUER',

    // In-game alerts
    alert_start:          "Pour construire un abri, coupez au moins 5 arbres.\nVous pouvez cliquer et maintenir pour couper plusieurs arbres à la fois.",
    alert_wood_ready:     "Maintenant que vous avez 5 morceaux de bois, vous pouvez construire votre abri.\nCliquez où vous souhaitez le placer.",
    alert_shelter_built:  "Maintenant que vous avez un abri, vous devez cultiver de la nourriture pour votre communauté.\nCliquez sur le bouton Planter, puis placez un potager où vous le souhaitez.",
    alert_farm_limit:     "Le nombre de potagers dépend de la taille de votre communauté.\nConstruisez plus d'abris pour accueillir plus de personnes.",
    alert_garden_ready:   "Votre première plantation est prête à être récoltée !\nCliquez vite pour récolter avant que la production ne se gâte.",
    alert_garden_harvest: "La récolte donne de la nourriture, du bois et permet d'augmenter le nombre d'habitants.\nVous pouvez maintenant replanter au même endroit.\nVous pouvez aussi agrandir votre communauté en construisant d'autres abris.\nAttention aux dommages causés à la santé des sols et au niveau d'eau.",
    alert_water_reforest: "Le niveau d'eau baisse.\nPlanter des arbres aide à préserver les ressources en eau.\nUtilisez le bouton \"Planter arbre\" !",
    alert_land_critical:  'Alerte ! La santé des sols est critique.',
    alert_water_low:      "Alerte ! Le niveau d'eau est critique.\nPlantez des arbres pour ralentir le déclin.",
    alert_water_crisis:   "Avertissement : votre communauté fait face à une grave crise écologique.\nIl est urgent de régénérer la forêt et de préserver les ressources en eau.",
    alert_build_limit:    "Il vous faut au moins un potager par abri.\nCréez plus de potagers avant de construire un nouvel abri.",
    alert_picture_saved:  'Un souvenir a été sauvegardé sur votre machine !',
    alert_all_full:       'Bravo, vous avez construit une communauté soutenable.\nMais rien n\'est acquis, continuez à préserver les ressources.',
  },
};
