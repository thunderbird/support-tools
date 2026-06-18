# When and how to use keywords to improve an article's search ranking

Source: https://support.mozilla.org/en-US/kb/when-and-how-to-use-keywords

The keywords field in an article can be used to improve search results. It should be used only under specific circumstances though, as misuse can hurt search. This article will explain when adding keywords is appropriate.

Note: The keywords field is not available when editing an existing article, unless you are a KB reviewer.

## Table of Contents

- 1 How does the search engine index?
- 2 How does the keywords field work?
- 3 When should I use the keywords field?

# How does the search engine index?

Any word in any field (title, keywords, summary, content for a knowledge base article) is indexed by our search engine in its root form based on the English stemmer (currently no other languages supported). Thus when we index "cookies" or someone searches for "cookies", the stemmer cuts it down to something like "cook". Stop words, such as the, is, and at, are indexed but ignored.

# How does the keywords field work?

The keywords field is indexed like any other field. This means that if your search term appears in the keyword field, that article will receive a certain number of points for match in this field. The article with the highest number of points across all indexed fields will be displayed at the top of the search results list.

The keywords field (and all content fields) have preset maximum numbers of points that can be scored in the field. Not every match wins the full points for that field though. The search algorithms take into account the total number of words in the field and use this to factor in how many points the match is worth of the total possible points. For example, if the content field has a total of 10 points possible and you have 10 words total in this field and one is a match, then you'd receive 1 point for that match.

Now, if you look at the same field and we have only 2 words and 1 of those words is a match, you would receive 5 total points. This is an oversimplification of the entire process, but the principle is accurate. The more words you have in a field, the less each match will be worth.

That means that if you add 10 keywords to an article that originally only had 1, you've just hurt the search rankings for that original keyword.

You can see an example of the entire search scoring algorithm here (/en-US/search?q=test&explain=1) or for any search by appending "&explain=1" without quotes to the url.

# When should I use the keywords field?

The keywords field should be used as a last resort to achieve the appropriate search ranking for an article. We refer to this process as Content Tuning. In Content Tuning we manipulate the words in an article based on the words our customers use. That helps to boost the article higher in the search rankings so our users can find what they are looking for. The Keywords field is a very powerful search booster, but it should only be used as a last resort. If your article is getting poor search rankings (article visits only available for English KB), you should follow these steps:

- Look at your title - Does your title accurately describe the circumstances in which this article would be useful?
- Search summary - Does your search summary contain the words a user would use to describe what they want?
- Body of the article - Look through the body of the article and be sure that you have used the language of the user. If there are a couple of different ways to describe the issue, try to use them both. Remember that brevity will increase the potency of the matches so write concisely.
- Keyword manipulation - If you've tried all of the other Content Tuning steps above and you are still getting poor results, you can try adding a keyword. The keyword should be the most important word your end user would use to describe the issue. DO NOT just list every possible way to describe the article topic in the keywords field. Remember, that will make each match worth fewer points in the search rankings.
