# Flat drawn stand-ins for the shop's real photos. Palette colours only.
# These are placeholders for what the Media library actually holds --
# marked as such on the canvas -- not an attempt at photographs.
SH = {
 'iron':  '<rect width="64" height="64" fill="#E9EBED"/><g stroke="#8A939C" stroke-width="2" fill="#DCE0E4"><path d="M4 22h56v8H4zM4 34h56v8H4zM4 46h56v8H4z"/></g><path d="M4 22h56" stroke="#59626B" stroke-width="2"/>',
 'nails': '<rect width="64" height="64" fill="#E9EBED"/><path d="M12 26h40v26H12z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"/><path d="M12 26l6-8h28l6 8" fill="#F7F9FB" stroke="#8A939C" stroke-width="2"/><g stroke="#59626B" stroke-width="2"><path d="M22 34v12M32 34v12M42 34v12"/></g>',
 'lock':  '<rect width="64" height="64" fill="#E9EBED"/><rect x="16" y="30" width="32" height="24" rx="3" fill="#B0700A"/><path d="M23 30v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#8A939C" stroke-width="4"/><circle cx="32" cy="41" r="3" fill="#FBEFD9"/>',
 'cement':'<rect width="64" height="64" fill="#E9EBED"/><path d="M18 16h28l4 8v28H14V24z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"/><path d="M14 32h36" stroke="#8A939C" stroke-width="2"/><path d="M22 40h20M22 46h13" stroke="#59626B" stroke-width="2"/>',
 'paint': '<rect width="64" height="64" fill="#E9EBED"/><rect x="18" y="22" width="28" height="30" rx="2" fill="#F7F9FB" stroke="#8A939C" stroke-width="2"/><path d="M18 22h28" stroke="#59626B" stroke-width="3"/><path d="M24 16h16v6H24z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"/><path d="M24 34h16v10H24z" fill="#DCE0E4"/>',
 'barrow':'<rect width="64" height="64" fill="#E9EBED"/><path d="M12 24h30l8 14H20z" fill="#B0700A"/><circle cx="22" cy="46" r="6" fill="none" stroke="#59626B" stroke-width="3"/><path d="M42 24l10-6M20 38v4" stroke="#8A939C" stroke-width="3"/>',
 'wire':  '<rect width="64" height="64" fill="#E9EBED"/><g fill="none" stroke="#8A939C" stroke-width="2"><ellipse cx="32" cy="26" rx="18" ry="7"/><path d="M14 26v12a18 7 0 0 0 36 0V26"/><ellipse cx="32" cy="38" rx="18" ry="7"/></g><ellipse cx="32" cy="26" rx="7" ry="3" fill="#DCE0E4"/>',
 'pvc':   '<rect width="64" height="64" fill="#E9EBED"/><g fill="#DCE0E4" stroke="#8A939C" stroke-width="2"><rect x="8" y="24" width="48" height="7" rx="3.5"/><rect x="8" y="34" width="48" height="7" rx="3.5"/></g><circle cx="12" cy="27.5" r="2" fill="#F7F9FB"/><circle cx="12" cy="37.5" r="2" fill="#F7F9FB"/>',
}
def thumb(k, cls='ow-thumb'):
    return ('<span class="%s"><svg class="ow-th-i" viewBox="0 0 64 64" aria-hidden="true">%s</svg></span>' % (cls, SH[k]))
def photo(k, cls='iv-ph-i'):
    return ('<svg class="%s img-zoomable" viewBox="0 0 64 64" role="img" aria-label="Photo">%s</svg>' % (cls, SH[k]))
