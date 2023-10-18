import type { App } from "obsidian";
import { pushWord, type WordsByFirstLetter } from "./suggester";
import type { AppHelper } from "../app-helper";
import { synonymAliases } from "../util/strings";
import type { InternalLinkWord, Word } from "../model/Word";

export class InternalLinkWordProvider {
  private words: Word[] = [];
  wordsByFirstLetter: WordsByFirstLetter = {};

  constructor(private app: App, private appHelper: AppHelper) {}

  refreshWords(option: {
    wordAsInternalLinkAlias: boolean;
    excludePathPrefixPatterns: string[];
    makeSynonymAboutEmoji: boolean;
    makeSynonymAboutAccentsDiacritics: boolean;
    frontMatterKeyForExclusion: string;
    suffixesToAccept: string[];
  }): void {
    this.clearWords();

    const resolvedInternalLinkWords: InternalLinkWord[] = this.app.vault
      .getMarkdownFiles()
      .filter((f) => {
        if (
          option.excludePathPrefixPatterns.some((x) => f.path.startsWith(x))
        ) {
          return false;
        }

        if (!option.frontMatterKeyForExclusion) {
          return true;
        }

        return !this.appHelper.getBoolFrontMatter(
          f,
          option.frontMatterKeyForExclusion
        );
      })
      .flatMap((x) => {
        const aliases = this.appHelper.getAliases(x);

        if (option.wordAsInternalLinkAlias) {
          return [
            ...option.suffixesToAccept.map((suffix) => ({
              value: `${x.basename}${suffix}`,
              type: "internalLink",
              createdPath: x.path,
              aliases: synonymAliases(x.basename, {
                emoji: option.makeSynonymAboutEmoji,
                accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
                suffix,
              }),
              description: x.path,
              aliasMeta: suffix ? {
                origin: x.path,
              } : undefined,
            })),
            ...aliases.flatMap((alias) => (
              option.suffixesToAccept.map((suffix) => ({
                value: `${alias}${suffix}`,
                type: "internalLink",
                createdPath: x.path,
                aliases: synonymAliases(alias, {
                  emoji: option.makeSynonymAboutEmoji,
                  accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
                  suffix,
                }),
                description: x.path,
                aliasMeta: {
                  origin: x.path,
                },
                }))
              )),
          ] as InternalLinkWord[];
        } else {
          return [
            ...option.suffixesToAccept.map((suffix) => ({
              value: `${x.basename}${suffix}`,
              type: "internalLink",
              createdPath: x.path,
              aliases: [
                ...synonymAliases(x.basename, {
                  emoji: option.makeSynonymAboutEmoji,
                  accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
                  suffix,
                }),
                ...aliases,
                ...aliases.flatMap((al) =>
                  synonymAliases(al, {
                    emoji: option.makeSynonymAboutEmoji,
                    accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
                    suffix,
                  })
                ),
              ],
              description: x.path,
              aliasMeta: suffix ? {
                origin: x.path,
              } : undefined,
            })),
          ] as InternalLinkWord[];
        }
      });

    const unresolvedInternalLinkWords: InternalLinkWord[] = this.appHelper
      .searchPhantomLinks()
      .map(({ path, link }) => {
        return {
          value: link,
          type: "internalLink",
          createdPath: path,
          aliases: synonymAliases(link, {
            emoji: option.makeSynonymAboutEmoji,
            accentsDiacritics: option.makeSynonymAboutAccentsDiacritics,
          }),
          description: `Appeared in -> ${path}`,
          phantom: true,
        };
      });

    this.words = [...resolvedInternalLinkWords, ...unresolvedInternalLinkWords];
    for (const word of this.words) {
      pushWord(this.wordsByFirstLetter, word.value.charAt(0), word);
      word.aliases?.forEach((a) =>
        pushWord(this.wordsByFirstLetter, a.charAt(0), word)
      );
    }
  }

  clearWords(): void {
    this.words = [];
    this.wordsByFirstLetter = {};
  }

  get wordCount(): number {
    return this.words.length;
  }
}
