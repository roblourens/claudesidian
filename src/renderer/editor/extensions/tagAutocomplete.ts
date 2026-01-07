/**
 * Tag autocomplete extension for CodeMirror.
 * 
 * Shows a popup with tag suggestions when typing # in the editor.
 * Filters as the user types and allows completion with Tab/Enter.
 */

import { 
  CompletionContext, 
  CompletionResult, 
  autocompletion,
  Completion
} from '@codemirror/autocomplete';

/**
 * Options for tag autocomplete.
 */
export interface TagAutocompleteOptions {
  /** Function to get all available tags */
  getTags: () => Promise<string[]>;
}

/**
 * Create the tag autocomplete extension.
 */
export function tagAutocomplete(options: TagAutocompleteOptions) {
  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        // Look for # followed by word characters
        const word = context.matchBefore(/#[a-zA-Z0-9_-]*/);
        
        // If no match or we're not after a #, don't show completions
        if (!word) return null;
        
        // If it's just # with nothing after, show all tags
        // If there's text after #, filter by that text
        const prefix = word.text.slice(1); // Remove the #
        
        try {
          const allTags = await options.getTags();
          
          // Filter tags by prefix
          const matchingTags = prefix 
            ? allTags.filter(tag => 
                tag.toLowerCase().startsWith(prefix.toLowerCase())
              )
            : allTags;
          
          if (matchingTags.length === 0) return null;
          
          const completions: Completion[] = matchingTags.map(tag => ({
            label: `#${tag}`,
            type: 'keyword',
            apply: `#${tag}`,
            detail: 'tag',
          }));
          
          return {
            from: word.from,
            options: completions,
            validFor: /^#[a-zA-Z0-9_-]*$/,
          };
        } catch (error) {
          console.error('Failed to fetch tags for autocomplete:', error);
          return null;
        }
      },
    ],
    // Configure autocomplete behavior
    activateOnTyping: true,
    maxRenderedOptions: 20,
    icons: false,
  });
}
