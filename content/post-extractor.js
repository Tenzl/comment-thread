// Doi mot khoi DOM thanh object post chuan hoa.
// Day la hop dong du lieu duy nhat giua nguon va pipeline loc.
(function () {
  const TAF = window.__TAF;
  const sel = TAF.selectors;

  function extract(block) {
    const permalink = sel.permalinkFromBlock(block);
    const postId = sel.postIdFromHref(permalink);
    if (!postId) return null;

    const author = sel.authorFromBlock(block);
    if (!author) return null;

    return {
      postId,
      permalink,
      author,
      text: sel.textFromBlock(block),
      timestamp: sel.timestampFromBlock(block),
      hasMedia: sel.hasMedia(block),
      source: 'dom',
    };
  }

  TAF.extractPost = extract;
})();
