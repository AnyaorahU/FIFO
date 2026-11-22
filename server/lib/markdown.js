// Tiny, safe parser for info page bodies. Produces data only (no HTML), so templates escape everything.
//   ## Heading      -> new section
//   - item          -> bullet point
//   other lines     -> paragraphs (blank line between paragraphs)
function parsePageBody(body) {
  const sections = [];
  let section = null;
  let para = [];
  const flush = () => { if (para.length) { ensure().p.push(para.join(' ')); para = []; } };
  const ensure = () => { if (!section) { section = { h: '', p: [], list: [] }; sections.push(section); } return section; };
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) { flush(); section = { h: line.slice(3).trim(), p: [], list: [] }; sections.push(section); }
    else if (/^[-*] /.test(line)) { flush(); ensure().list.push(line.slice(2).trim()); }
    else if (!line) flush();
    else para.push(line);
  }
  flush();
  return sections;
}

module.exports = { parsePageBody };
