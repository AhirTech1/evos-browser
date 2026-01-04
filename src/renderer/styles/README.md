# Renderer Styles

CSS stylesheets for the EVOS Browser interface. All styles follow a modular approach where each file handles a specific component or area.

## Stylesheets

### `main.css`
Base styles and global layout.
- CSS variables for theming
- Reset and normalization
- Base typography
- Global layout structure
- Common utilities

### `titlebar.css`
Custom window title bar (Windows/Linux).
- Window controls (minimize, maximize, close)
- Drag region
- Icon and title
- Platform-specific styles

### `tabs.css`
Tab bar and individual tab styling.
- Tab appearance and states
- Tab icons and close buttons
- Active/inactive tab styles
- Tab animations
- Audio indicators

### `tab-groups.css`
Tab groups and organization.
- Group containers
- Group headers and labels
- Collapse/expand animations
- Group color coding

### `navbar.css`
Navigation bar and address bar.
- Navigation buttons (back, forward, reload)
- URL input field
- Search integration
- Security indicators
- Bookmark button

### `panels.css`
Sidebar panels (history, bookmarks, downloads).
- Panel container and layout
- Panel headers
- List items and entries
- Search within panels
- Panel animations

### `ai-panel.css`
AI assistant interface.
- Chat container and messages
- Message bubbles (user/AI)
- Quick actions sidebar
- Input area
- Loading states
- Code syntax highlighting
- Streaming message animations

### `agent.css`
AI agent-specific UI components.
- Agent status indicators
- Task cards
- Progress displays
- Agent notifications

### `quick-action-bar.css`
Quick action toolbar.
- Action buttons
- Tooltips
- Button states
- Icon styling

## Design System

### Color Palette
The application uses CSS variables for consistent theming:

```css
/* Light mode */
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--text-primary: #000000;
--text-secondary: #666666;
--accent: #4285f4;

/* Dark mode */
--bg-primary: #1e1e1e;
--bg-secondary: #2d2d2d;
--text-primary: #ffffff;
--text-secondary: #b3b3b3;
--accent: #8ab4f8;
```

### Typography
- **Primary font**: System UI fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`)
- **Monospace**: For code and technical content

### Spacing
Consistent spacing scale:
- `4px, 8px, 12px, 16px, 24px, 32px, 48px`

### Border Radius
- **Small**: `4px` (buttons, inputs)
- **Medium**: `8px` (cards, panels)
- **Large**: `12px` (modals, major containers)

## Dark Mode

All stylesheets support dark mode via CSS variables. The theme switches based on user preference in settings.

## Responsive Design

The browser UI is designed to work across different window sizes:
- **Minimum width**: 800px
- **Minimum height**: 600px
- Elements automatically adjust or hide based on available space

## Development Guidelines

### Adding New Styles
1. Create a new CSS file for new components if needed
2. Import it in `index.html` or `settings.html`
3. Use CSS variables for colors and spacing
4. Support both light and dark modes
5. Follow existing naming conventions

### Naming Conventions
- **BEM-like**: `.component__element--modifier`
- **Utility classes**: `.u-flex`, `.u-hidden`
- **State classes**: `.is-active`, `.is-loading`

### Best Practices
- Mobile-first approach (even though it's a desktop app)
- Avoid `!important` unless absolutely necessary
- Use CSS Grid and Flexbox for layouts
- Keep selectors shallow (max 3 levels)
- Group related properties
- Add comments for complex or non-obvious styles
