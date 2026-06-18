# Using Templates

Source: https://support.mozilla.org/en-US/kb/using-templates

Templates are a way of reusing pieces of content in Knowledge Base articles. Instead of writing a set of instructions multiple times, you can create and update it in one place, and then refer to it in other pages. The other pages will stay up-to-date with changes to the Template automatically!

Localizers: when localizing templates, do not translate the name of the page - just use the original one! So, if the template is named Template:browsersettings, do not translate any of the elements in the name - just use Template:browsersettings in your locale. This is important to have the templates function properly.

## Table of Contents

- 1 What are Templates
- 2 How to make a Template
- 3 How to include a Template in an Article
- 4 Templates and numbered lists
- 5 Using arguments with a Template
- 6 Knowledge Base guidelines

# What are Templates

A Template is just a special wiki page whose name starts with "Template:". It has all the features of a wiki page: it can be localized, it has a history, it understands wiki markup.

Templates are listed on this page (/en-US/contributors/kb-overview?category=60). An alphabetical list of existing Templates can be found here (/en-US/kb/category/60).

# How to make a Template

- Create a new KB article (/en-US/kb/new). Try it out by creating a new KB article on our test server (https://support.allizom.org/en-US/kb/new).
- Make sure the name begins with "Template:" - for example, Template:aboutconfig (/en-US/kb/Template:aboutconfig).
- Set the Category to "Template".
- Continue writing the Template the same way you would any other Knowledge Base article.

# How to include a Template in an Article

To use a template in a wiki page, all you have to do is "link" to the template.

For example:

[[Template:Some Template]]
or
[[T:Some Template]]

Instead of creating a link, the content of Template:Some Template will be included into the current page. Any wiki markup in the template will be rendered.

# Templates and numbered lists

For most purposes, using a numbered list in a template works exactly the same way as it does in any other Knowledge Base document. There is one important exception — if your template is a numbered list that will be used as part of a larger numbered list, the numbering will break.

Workaround:

Don't use "#" on any of the steps and Do add <li> </li> around the second and subsequent steps, like this:

This is the first step in your list

<li>This is the second step</li>

<li>This is the third step</li>

Then, when adding the template to an article, add the "#" before the template:

#[[T:List]]

#This is another step that's not part of the template

It will look like this:

- This is the first step in your list
- This is the second step
- This is the third step
- This is another step that's not part of the template

Another important piece - you can't use block level {for} (/en-US/kb/how-to-use-for#w_inline-and-block-level-contexts) in these templates. For example:

Bad:

{for not fx10}

First step - Firefox 9 and lower

{/for}

{for fx10}

First step - Firefox 10 and higher

{/for}

<li>This is the second step</li>

Good:

{for not fx10}First step - Firefox 9 and lower{/for}{for fx10}

First step - Firefox 10 and higher{/for}

<li>This is the second step</li>

# Using arguments with a Template

Templates support passing in arguments, to let you reuse content that is almost the same.

Say, for example, you had a standard notice that told users that a document only applied to Firefox 4, and another version that said it only applied to Firefox 3.6. The text of those notices might be identical except for the Firefox version: a perfect time to use a template!

Template:OnlyVersionX:

{note}This document or section only applies to '''Firefox {{{1}}}'''!{/note}

Then, in one wiki page, you could do this:

[[Template:OnlyVersionX|4]]

And in another page, you could do:

[[Template:OnlyVersionX|3.6]]

You can use multiple arguments or the same argument twice, too!

Template:XLikesY:

# {{{2}}} likes {{{1}}}.
# {{{3}}} likes {{{2}}}.
# Class! Nobody likes {{{2}}}!

Then to use it:

[[Template:XLikesY|Lisa|Milhouse|Janey]]

This would result in:

- Milhouse likes Lisa.
- Janey likes Milhouse.
- Class! Nobody likes Milhouse!

Keeping track of all those numbers can get confusing, so you can also name arguments to a template:

Template:XPrecededY:

First comes {{{first}}}, then comes {{{second}}}.

And using it:

[[Template:XPrecededY|first=love|second=marriage]]

With named arguments, you don't need to worry about the order when you use the template:

[[Template:XPrecededY|second=marriage|first=love]]

Both examples of using Template:XPrecededY will have the same result.

# Knowledge Base guidelines

More guidelines on Knowledge Base contribution can be found here (https://support.mozilla.org/en-US/products/contributor/kb).
