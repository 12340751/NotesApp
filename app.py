import sys
import os
import json
import markdown
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QListWidget, QTextEdit, QPushButton, QLabel, QFileDialog, 
    QFrame, QSplitter, QInputDialog, QMessageBox
)
from PyQt6.QtCore import Qt, QUrl, pyqtSignal, QSize
from PyQt6.QtGui import QIcon, QFont, QFontDatabase, QColor, QPalette
from PyQt6.QtWebEngineWidgets import QWebEngineView

class NotesApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Minimalist Markdown Notes")
        self.resize(1200, 800)
        self.setMinimumSize(900, 600)

        # Paths
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.notes_dir = os.path.join(self.base_dir, "notes")
        self.themes_dir = os.path.join(self.base_dir, "themes")
        self.fonts_dir = os.path.join(self.base_dir, "fonts")
        self.settings_path = os.path.join(self.base_dir, "settings.json")

        self.init_folders()
        self.load_settings()
        self.init_ui()
        self.load_notes_list()

    def init_folders(self):
        for d in [self.notes_dir, self.themes_dir, self.fonts_dir]:
            if not os.path.exists(d):
                os.makedirs(d)

    def load_settings(self):
        if os.path.exists(self.settings_path):
            with open(self.settings_path, 'r', encoding='utf-8') as f:
                self.settings = json.load(f)
        else:
            self.settings = {"theme": "default", "mode": "dark"}

    def save_settings(self):
        with open(self.settings_path, 'w', encoding='utf-8') as f:
            json.dump(self.settings, f, indent=2)

    def init_ui(self):
        # Main Widget
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QHBoxLayout(self.central_widget)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)

        # Sidebar
        self.sidebar = QFrame()
        self.sidebar.setFixedWidth(250)
        self.sidebar.setObjectName("sidebar")
        self.sidebar_layout = QVBoxLayout(self.sidebar)
        
        self.title_label = QLabel("NOTES")
        self.title_label.setObjectName("sidebar-title")
        self.sidebar_layout.addWidget(self.title_label)

        self.notes_list = QListWidget()
        self.notes_list.itemClicked.connect(self.load_note)
        self.sidebar_layout.addWidget(self.notes_list)

        self.btn_new = QPushButton("+ New Note")
        self.btn_new.clicked.connect(self.create_new_note)
        self.sidebar_layout.addWidget(self.btn_new)
        
        self.btn_theme = QPushButton("Theme Settings")
        # In a full version, we'd open a theme editor dialog
        self.sidebar_layout.addWidget(self.btn_theme)

        self.main_layout.addWidget(self.sidebar)

        # Content Area (Splitter for Editor and Preview)
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Editor
        self.editor = QTextEdit()
        self.editor.textChanged.connect(self.update_preview)
        self.editor.setPlaceholderText("Write your markdown here...")
        
        # Preview (WebEngine for CSS support)
        self.preview = QWebEngineView()
        
        self.splitter.addWidget(self.editor)
        self.splitter.addWidget(self.preview)
        self.splitter.setStretchFactor(0, 1)
        self.splitter.setStretchFactor(1, 1)

        self.main_layout.addWidget(self.splitter)

        self.apply_styles()

    def apply_styles(self):
        # Basic styling to mimic the Electron version
        # In a real app, we'd load these from the Themes folder
        style = """
            QMainWindow { background-color: #1a1b26; }
            #sidebar { 
                background-color: #16161e; 
                border-right: 1px solid #292e42;
            }
            #sidebar-title {
                color: #7aa2f7;
                font-size: 18px;
                font-weight: bold;
                padding: 10px;
            }
            QListWidget {
                background: transparent;
                border: none;
                color: #a9b1d6;
                font-size: 14px;
            }
            QListWidget::item {
                padding: 10px;
                border-radius: 5px;
            }
            QListWidget::item:selected {
                background: #24283b;
                color: #7aa2f7;
            }
            QTextEdit {
                background-color: #1a1b26;
                color: #a9b1d6;
                border: none;
                padding: 20px;
                font-family: 'Consolas', 'Monospace';
                font-size: 16px;
                line-height: 1.6;
            }
            QPushButton {
                background: #24283b;
                color: #7aa2f7;
                border: none;
                padding: 10px;
                margin: 5px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #292e42;
            }
        """
        self.setStyleSheet(style)

    def load_notes_list(self):
        self.notes_list.clear()
        files = [f for f in os.listdir(self.notes_dir) if f.endswith('.md')]
        for f in files:
            self.notes_list.addItem(f.replace('.md', ''))

    def load_note(self, item):
        name = item.text()
        path = os.path.join(self.notes_dir, f"{name}.md")
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            self.editor.blockSignals(True)
            self.editor.setPlainText(content)
            self.editor.blockSignals(False)
            self.update_preview()

    def create_new_note(self):
        name, ok = QInputDialog.getText(self, "New Note", "Note name:")
        if ok and name:
            path = os.path.join(self.notes_dir, f"{name}.md")
            if not os.path.exists(path):
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(f"# {name}\n\nStart writing...")
                self.load_notes_list()
            else:
                QMessageBox.warning(self, "Warning", "Note already exists!")

    def update_preview(self):
        content = self.editor.toPlainText()
        html_content = markdown.markdown(content, extensions=['fenced_code', 'tables'])
        
        # Embed in basic HTML structure with CSS
        full_html = f"""
        <html>
        <head>
            <style>
                body {{
                    background-color: #1a1b26;
                    color: #a9b1d6;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 40px;
                    line-height: 1.6;
                }}
                h1, h2, h3 {{ color: #7aa2f7; border-bottom: 1px solid #292e42; padding-bottom: 10px; }}
                code {{ background-color: #24283b; padding: 2px 4px; border-radius: 4px; font-family: 'Consolas'; }}
                pre {{ background-color: #24283b; padding: 15px; border-radius: 8px; overflow-x: auto; }}
                blockquote {{ border-left: 4px solid #7aa2f7; margin-left: 0; padding-left: 20px; color: #565f89; italic; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #292e42; padding: 8px; text-align: left; }}
                th {{ background-color: #24283b; }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """
        self.preview.setHtml(full_html)
        
        # Auto-save
        current_item = self.notes_list.currentItem()
        if current_item:
            name = current_item.text()
            path = os.path.join(self.notes_dir, f"{name}.md")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = NotesApp()
    window.show()
    sys.exit(app.exec())
