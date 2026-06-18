# How to use "For" tags

Source: https://support.mozilla.org/en-US/kb/how-to-use-for

One of the great features of our Knowledge Base is the ability to show instructions customized for operating systems (Windows, macOS, Linux) and Firefox versions. We can say, for example, that a certain section of a help article is “for” Windows users and Mac and Linux users won't see it. The feature is designed to work invisibly. When someone opens a help article, we'll automatically detect what operating system and version of Firefox they are using and show the appropriate instructions. This article goes over the details of how to use {for} markup in Knowledge Base articles.

Localizers: When localizing articles with {for} and {/for} elements in the content, do not translate anything inside the { and } brackets! Keep them the same way they look in the original text. This is important to have the element function properly.

## Table of Contents

- 1 How to switch instructions to different operating systems or Firefox versions
- 2 Basic syntax and behavior

- 2.1 Operating systems
- 2.2 Firefox versions

- 2.2.1 Show instructions for only one version of Firefox
- 2.3 Combining operating systems and Firefox versions
- 2.4 Negating conditions
- 2.5 Leverage {for} tags for advanced versioning control
- 2.6 When the contents are shown
- 2.7 Operating system and product abbreviations
- 2.8 Inline and block-level contexts
- 3 Best practices for using {for} in articles
- 4 Complete Knowledge Base guidelines

# How to switch instructions to different operating systems or Firefox versions

In order to follow the example in this article, you'll have to switch the article selector to different operating systems and Firefox versions. It's located in the right panel of the article, under Editing Tools.

# Basic syntax and behavior

## Operating systems

Here is the syntax to show an image for Windows 10:

{for win10}[[Image:Windows Logo]]{/for}

- Change the selector to Windows 10 to see the image:

- If you change the selector to Windows XP, Windows 7, Windows 8, Windows 11, Mac or Linux, the image above won't be shown because it's not “for” them.

Although the Windows selector doesn't exist, you can write instructions that apply to all Windows versions:

{for win}[[Image:Image:vista.jpg]]{/for}

- Change the selector to Windows XP, Windows 7/Vista, Windows 8, Windows 10 or Windows 11 to see the image:

- If you change the selector to Mac or Linux, the image above won't be shown because it's not “for” them.

## Firefox versions

Here is the syntax to show something for Firefox 140 and above:

{for fx140}[[Image:Firefox Quantum Logo]]{/for}

- Change the selector to Firefox 140 or higher to see the image:

- If you change the selector to Firefox 139 or lower, the image above will disappear because it's not “for” those versions.

### Show instructions for only one version of Firefox

To show instructions only for Firefox 140, use the “=” operator:

{for =fx140}[[Image:Firefox Quantum Logo]]{/for}

- Now the image only shows when you change the selector to Firefox 140:

## Combining operating systems and Firefox versions

You can specify an operating system and a Firefox version by separating them with a comma:

{for win,fx140}[[Image:Windows Logo]][[Image:Quantum Logo]]{/for}

- Change the selector to Windows and Firefox 140 or higher to see images:

A more complex situation with an implied “for” can be written like this:

{for mac, win10, win11, =fx128, fx140}[[Image:Windows Logo]][[Image:macos.jpg]][[Image:Firefox Quantum Logo]]{/for}

- Change the selector to Mac or Windows 10 or Windows 11 and Firefox 128 or Firefox 140 and above to see images:

## Negating conditions

You can negate a condition by preceding it with the word not. A negated condition is true if and only if the condition is false. For example, the condition

not fx140

is true if the Firefox version is less than 140.

## Leverage {for} tags for advanced versioning control

With frequent updates and feature releases in Firefox, for tags play a key role for targeted content curation, enabling us to deliver relevant information to users based on their specific version of Firefox. Key applications of these tags include:

- Early access for Nightly and Beta Users: It allows us to present upcoming features or changes to users who are on Nightly and Beta channels, giving them a heads-up about what they might find. This ensures that our most engaged and technical users can start exploring new functionalities ahead of the broader community.
- Localization ahead of launch: for tags allow us to publish content for upcoming versions ahead of their public release. This allows our localization community to prepare translations early, guaranteeing multi-language support the moment a new version goes live in the Production channel.
- Avoid confusion among general audience: Using for tags, we strategically avoid exposing our general audience to premature information, thereby preventing confusion about what's currently available in their current version of Firefox.

## When the contents are shown

Formally, the markup between {for} and {/for} will be shown if both of these conditions are met:

- The {for} has no operating system (OS) condition, or it has at least one OS condition that is true regarding the OS the user is running (or has manually selected).
- The {for} has no Firefox version condition, or it has at least one Firefox version condition that is true regarding the Firefox version the user is running (or has manually selected).

Otherwise, the contents of the {for}…{/for} are not shown.

Any content enclosed within a {for} tag, aimed at earlier Firefox versions, remains visible to users of those versions even if those versions aren't listed in the version selector.

A few other things to note:

- Spaces after the commas are optional.
- {for} and other wiki markup don't work in article search summaries.
- Headings which are hidden by {for} blocks do not appear in the page's table of contents. If the user causes them to show by manually selecting the right OS/browser combination, the table of contents entries instantly appear.

## Operating system and product abbreviations

These are the operating system and product abbreviations available for use with {for}:

- win (Windows)
- winxp (Windows XP/2000/Server 2003)
- win7 (Windows 7/Vista/Server 2008)
- win8 (Windows 8/8.1/Server 2012)
- win10 (Windows 10)
- win11 (Windows 11)
- mac (macOS)
- linux (Linux)
- fxN where N = the Firefox (desktop) version, for example fx115, fx116, fx117, etc.
- mN where N = the Firefox for Android (mobile) version, for example m115, m116, m117, etc.
- tbN where N = the Thunderbird version, for example tb91, tb102, tb115, etc.

You have to use fxN in Firefox support articles, mN in Firefox for Android support articles and tbN in Thunderbird support articles.

## Inline and block-level contexts

{for} can be used in both inline and block-level contexts (in the HTML sense). The inline form takes effect when working within a line of text:

This is {for win}inline use{/for}.

The block form is used to wrap entire paragraphs, ordered lists, headings, and so on. The only caveat is that, when using the block form, the {for} and {/for} should each be on a line by itself. Otherwise, it might be considered part of a neighboring paragraph and produce surprising results.

{for win}
This is block-level.
*One
*Two
{/for}

# Best practices for using {for} in articles

When writing instructions for different operating systems, it's best to write complete sentences and paragraphs for each OS/Firefox version, even if it means duplicating things. This makes the article easier to understand, maintain and localize. When it comes time, for example, to remove specific instructions for Firefox 140 and below, those sections can just be deleted rather than trying to excise them from a larger section.

- The wrong way to use {for}:
#{for not fx140}{for win,linux}At the top of the Firefox window{/for}{for mac}On the menu bar{/for}, click on the {/for}{for fx140}Click the menu button, go over to the {menu History} menu{/for}{for winxp,mac,linux,not fx140}{menu Tools} menu{/for}{for win10,win11,not fx140}{menu Firefox} menu, go over to the {menu History} menu{/for} and select {menu Clear Recent History…}
- The right way to use {for}:
{for not fx140}
#{for win10,win11}At the top of the Firefox window, click on the {menu Firefox} menu, go over to the {menu History} menu and select {menu Clear Recent History…}{/for}{for mac}On the menu bar, click on the {menu Tools} menu and select {menu Clear Recent History…}{/for}{for winxp,linux}At the top of the Firefox window, click on the {menu Tools} menu and select {menu Clear Recent History…}{/for}
{/for}
{for fx140}
#Click the menu button, go over to the {menu History} menu and select {menu Clear Recent History…}
{/for}
- In the following example, we treat Firefox 140 and below, Firefox 141/142, and Firefox 143 and above as three different sets of instructions. That's often the case, but more and more as we change Firefox every four weeks we'll see more changes in later versions. They'll look like this:
{for not fx141}
#The old instructions.
{/for}
{for =fx141,=fx142}
#The new instructions.
{/for}
{for fx143}
#The NEW new instructions.
{/for}

# Complete Knowledge Base guidelines

See more guidelines on Knowledge Base contribution (https://support.mozilla.org/en-US/products/contributor/kb).
