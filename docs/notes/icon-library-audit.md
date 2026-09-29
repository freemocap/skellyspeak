# Icon library audit

Status: implemented after review. Appearance, cards, deck-add and deck-added retain their custom shapes by explicit user preference; the other 35 proposed replacements now use Lucide. Preview sheets show the original proposal, including the four subsequently declined replacements.

The four effort icons (Smile, Wrench, BicepsFlexed, ThumbsUp) are approved and already use lucide-react.

38 custom ToolbarIcon paths and the compact ShareLogsButton icon can use the installed package. Keep existing semantic names, dimensions, stroke weights, accessible labels, and interaction behavior.

| Current name | Lucide component |
| --- | --- |
| reload | RotateCw |
| settings | SlidersHorizontal |
| profile | UserRound |
| menu | Menu |
| more | Ellipsis |
| star | Star |
| appearance | Contrast |
| reading | BookOpen |
| key | KeyRound |
| models | Cpu |
| globe | Globe |
| voice | Volume2 |
| keyboard | Keyboard |
| update | Download |
| data | Database |
| close | X |
| cog | Settings |
| sun | Sun |
| moon | Moon |
| idea | Lightbulb |
| plus | Plus |
| check | Check |
| deck-add | CopyPlus |
| deck-added | CopyCheck |
| chat | MessageSquare |
| cards | Copy |
| mic | Mic |
| pause | Pause |
| stop | Square |
| play | Play |
| trash | Trash2 |
| chevron | ChevronDown |
| expand | Maximize2 |
| collapse | Minimize2 |
| popout | ExternalLink |
| popin | PanelTopClose |
| waveform | AudioLines |
| edit | Pencil |
| share-logs | Share |

PanelTopClose represents returning a detached panel to the main window. The proposed Contrast, Copy, CopyPlus and CopyCheck replacements were declined; original custom paths remain unchanged.

Excluded: InspectionTracks audio plots; OperationDetailDialog and PhraseSummary sparklines; ConversationFeedbackCard score ring; DomainEvidenceTree learning visualization; admin entry usage chart; public logo artwork. These convey data or identity rather than generic control icons.

Preview sheets: icon-replacements-1.png and icon-replacements-2.png. All proposed shapes render directly from the installed lucide-react package; existing shapes render from current source.

Verification: UI TypeScript/production build passed; 24 targeted tests passed across shared log actions, progress counters, top bar, and dependency boundaries. The four retained custom SVG definitions match their original paths exactly.
