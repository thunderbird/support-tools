# Markup chart

Source: https://support.mozilla.org/en-US/kb/markup-chart

This is the wiki and special markup available on SUMO.

# Markup common to articles and forum posts

Description | What it looks like | Wiki Syntax

Typeface |  |

Bold | bold | '''bold'''

Italics | italics | ''italics''

Underline | underline | <u>underline</u>

Superscript | Text in superscript | Text in <sup>superscript</sup>

Subscript | Text in subscript | Text in <sub>subscript</sub>

Strikeout | Strikeout or Strikeout | <s>Strikeout</s> or <del>Strikeout</del>

Code | code | <code>code</code>

Quoting |  |

Blockquote | blockquote | <blockquote>blockquote</blockquote>

Preformatted text (start each line with a space) | This    is
preformatted | This   is preformatted

Text breaks |  |

Line break | line
break | line
break

Line break within tables, lists, etc. | linebreak | line<br>break

Horizontal rule | text above | text above
----
text below

Links |  |

Link to other articles | Page Title | [[Page Title]]

Link specific text to other articles | text | [[Page Title|text]]

Link specific text to anchor in the same article | text | [[#w_anchor|text]]

Link specific text to anchor in other articles | text | [[Page Title#w_anchor|text]]

External link | http://www.mozilla.com/ | [http://www.mozilla.com/]

External link with text | Mozilla | [http://www.mozilla.com/ Mozilla]

Redirect (replace the article's content with the following markup) | REDIRECT Page title | REDIRECT [[Page title]]

Lists |  |

Numbered list | Item 1
 Item 2
 Item 3 | # Item 1# Item 2# Item 3

Unordered list | Item A
 Item B
 Item C | * Item A* Item B* Item C

Unordered sub-list within a numbered list | Item 1
 Item 2
 Item 2a
 Item 2b

 Item 3 | # Item 1# Item 2#* Item 2a#* Item 2b# Item 3

Mixed sub-lists (You can mix and match multiple list types) | Item A
 Item A.1
 Item A.1.a

 Item A.1.1 | * Item A*# Item A.1*#* Item A.1.a*## Item A.1.1

Tables |  |

Table with caption, column headings and multiple rows | Table caption

col 1col 2

AB

CD | {|
|+ Table caption
!col 1!!col 2
|-
|A||B
|-
|C||D
|}

Media |  |

Image | An image | [[Image:Image Title]]

Image resized | Image with a width of 300px | [[Image:Image Title|width=300]]

YouTube video | An embedded YouTube video | [[Video:youtube_video_link]][[V:youtube_video_link]]

Miscellaneous |  |

Escape wiki parsing | [[Not a link]] | <nowiki>[[Not a link]]</nowiki>

Hidden comments |  | <!-- comment -->

# Markup for articles

## Article Wiki markup

Description | What it looks like | Wiki Syntax

Headings |  |

Table of Contents | Table of Contents  (list of article headings) | __TOC__

Indicates a level 1 heading | Level 1 | = Level 1 =

Indicates a level 2 heading | Level 2 | == Level 2 ==

Indicates a level 3 heading | Level 3 | === Level 3 ===

Indicates a level 4 heading | Level 4 | ==== Level 4 ====

Indicates a level 5 heading | Level 5 | ===== Level 5 =====

Indicates a level 6 heading | Level 6 | ====== Level 6 ======

Customized styling |  |

Note | text | {note}text{/note}

Warning | text | {warning}text{/warning}

Preference name / value | text | {pref text}

File name / path | file | {filepath file}

Keyboard shortcut | Ctrl + T | {key Ctrl+T}

Menu path | Firefox | {menu Firefox}

Button | Button | {button Button}

Menu button | ☰ | &#9776;

Indent text |  |

Definition list | Term
 Definition
 Term
 Definition a
 Definition b
 Reference | ; Term: Definition; Term: Definition a: Definition b:: Reference

Media |  |

Image | An image | [[Image:Image Title]]

Image resized | Image with a width of 300px | [[Image:Image Title|width=300]]

YouTube video | An embedded YouTube video | [[Video:youtube_video_link]][[V:youtube_video_link]] |  |

Collapsible sections |  |

Add a collapsible section | H2 or H3 heading
Text | [[UI:details_start]]==H2 or H3 heading==Text[[UI:details_end]]

## {for}

{for} doesn't get any special styling. It's useful for specifying that content only applies to certain operating systems or Firefox versions. See How to use "For" tags (/en-US/kb/how-to-use-for) for details.

## Templates

Templates are a way of reusing small pieces of content. Instead of writing a message twice, you can create and update it in one place, and then refer to it in other pages. The other pages will stay up-to-date with changes to the Template automatically! See Using Templates (/en-US/kb/using-templates) for details.
