// Turns what you type into a log line (templates) and log lines into HTML
// (a small, safe markdown subset).
(() => {
  const PRONOUNS = {
    he: { they: 'he', them: 'him', their: 'his' },
    she: { they: 'she', them: 'her', their: 'her' },
    they: { they: 'they', them: 'them', their: 'their' },
    it: { they: 'it', them: 'it', their: 'its' },
  };
  RP.PRONOUNS = PRONOUNS;

  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // Fill {placeholders}. Unknown placeholders are left as typed.
  RP.fill = (template, vars) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

  RP.pronounVars = p => {
    const set = PRONOUNS[p] || PRONOUNS.they;
    return { they: set.they, them: set.them, their: set.their, They: cap(set.they), Them: cap(set.them), Their: cap(set.their) };
  };

  // Build the line for Do / Say / OOC with the current character name.
  // verb: what the character does with the words ("whispers"); blank = "says".
  RP.formatLine = ({ mode, text, name, lang, pronoun, verb }, templates = RP.settings.templates) => {
    let body = (text || '').trim();
    if (!body) return '';
    const who = (name || '').trim() || 'Someone';
    let key = mode === 'do' ? 'do' : mode === 'ooc' ? 'ooc' : 'say';
    let tpl;
    const said = (verb || '').trim() || 'says';
    if (key === 'say') {
      body = body.replace(/^["“”]+|["“”]+$/g, '');   // don't double-wrap quotes
      if (lang) key = 'sayLang';
      tpl = templates[key] || RP.DEFAULT_TEMPLATES[key];
      // A template edited before {verb} existed still has "says" written in.
      if (!tpl.includes('{verb}') && said !== 'says') tpl = tpl.replace(/\bsays\b/, () => said);
    }
    return RP.fill(tpl || templates[key] || RP.DEFAULT_TEMPLATES[key], {
      name: who, text: body, lang: lang || '', verb: said, ...RP.pronounVars(pronoun),
    });
  };

  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // **bold**, *italic*, ~~strike~~, ((ooc)) and "dialogue" highlighting.
  RP.renderMarkdown = src => {
    let s = esc(src || '');
    s = s.replace(/\(\(([\s\S]+?)\)\)/g, '<span class="ooc">(($1))</span>');
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
    s = s.replace(/(&quot;|“)([\s\S]+?)(&quot;|”)/g, '<span class="q">$1$2$3</span>');
    return s.replace(/\n/g, '<br>');
  };

  RP.stripMarkdown = src => (src || '').replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/~~([\s\S]+?)~~/g, '$1').replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1$2');
})();
