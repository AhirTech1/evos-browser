"""
EVOS AI - Memory System
Vector-based memory for storing and retrieving browsing history and knowledge
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import sqlite3
import hashlib

from config import settings

# Try to import chromadb, fall back to simple SQLite if not available
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("[Memory] ChromaDB not available, using SQLite fallback")


class MemoryStore:
    """
    Hybrid memory system combining:
    - SQLite for structured data (pages, entities, relationships)
    - ChromaDB for vector search (semantic similarity)
    """
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(settings.memory_db_path, "memory.db")
        self.vector_db = None
        self.collection = None
        self._initialized = False
        
    async def initialize(self) -> bool:
        """Initialize the memory system"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            # Initialize SQLite
            self._init_sqlite()
            
            # Initialize ChromaDB if available
            if CHROMADB_AVAILABLE:
                self._init_chromadb()
            
            self._initialized = True
            print(f"[Memory] Initialized at {self.db_path}")
            return True
            
        except Exception as e:
            print(f"[Memory] Initialization failed: {e}")
            return False
    
    def _init_sqlite(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Pages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pages (
                id TEXT PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                title TEXT,
                domain TEXT,
                content TEXT,
                summary TEXT,
                first_visit TIMESTAMP,
                last_visit TIMESTAMP,
                visit_count INTEGER DEFAULT 1,
                importance_score REAL DEFAULT 0.5,
                tags TEXT,
                metadata TEXT
            )
        ''')
        
        # Entities table (people, products, concepts extracted from pages)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                description TEXT,
                first_seen TIMESTAMP,
                last_seen TIMESTAMP,
                occurrence_count INTEGER DEFAULT 1,
                metadata TEXT
            )
        ''')
        
        # Page-Entity relationships
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_entities (
                page_id TEXT,
                entity_id TEXT,
                relevance_score REAL DEFAULT 0.5,
                context TEXT,
                PRIMARY KEY (page_id, entity_id),
                FOREIGN KEY (page_id) REFERENCES pages(id),
                FOREIGN KEY (entity_id) REFERENCES entities(id)
            )
        ''')
        
        # Notes/annotations
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                page_id TEXT,
                content TEXT NOT NULL,
                created_at TIMESTAMP,
                tags TEXT,
                FOREIGN KEY (page_id) REFERENCES pages(id)
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pages_last_visit ON pages(last_visit)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)')
        
        conn.commit()
        conn.close()
    
    def _init_chromadb(self):
        """Initialize ChromaDB for vector search"""
        try:
            chroma_path = os.path.join(settings.memory_db_path, "chroma")
            self.vector_db = chromadb.PersistentClient(
                path=chroma_path,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            self.collection = self.vector_db.get_or_create_collection(
                name="pages",
                metadata={"hnsw:space": "cosine"}
            )
            print(f"[Memory] ChromaDB initialized with {self.collection.count()} documents")
        except Exception as e:
            print(f"[Memory] ChromaDB initialization failed: {e}")
            self.vector_db = None
            self.collection = None
    
    def _generate_id(self, content: str) -> str:
        """Generate a unique ID based on content"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def remember_page(
        self,
        url: str,
        title: str,
        content: str,
        summary: Optional[str] = None,
        tags: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Store a page in memory"""
        
        from urllib.parse import urlparse
        
        page_id = self._generate_id(url)
        domain = urlparse(url).netloc
        now = datetime.now().isoformat()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check if page exists
        cursor.execute('SELECT id, visit_count FROM pages WHERE url = ?', (url,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing page
            cursor.execute('''
                UPDATE pages SET
                    title = ?,
                    content = ?,
                    summary = ?,
                    last_visit = ?,
                    visit_count = visit_count + 1,
                    tags = ?,
                    metadata = ?
                WHERE url = ?
            ''', (
                title,
                content[:50000],  # Limit content size
                summary,
                now,
                json.dumps(tags or []),
                json.dumps(metadata or {}),
                url
            ))
            page_id = existing[0]
        else:
            # Insert new page
            cursor.execute('''
                INSERT INTO pages (id, url, title, domain, content, summary, first_visit, last_visit, tags, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                page_id,
                url,
                title,
                domain,
                content[:50000],
                summary,
                now,
                now,
                json.dumps(tags or []),
                json.dumps(metadata or {})
            ))
        
        conn.commit()
        conn.close()
        
        # Add to vector store for semantic search
        if self.collection:
            try:
                # Create a searchable text
                search_text = f"{title}\n{summary or ''}\n{content[:2000]}"
                
                self.collection.upsert(
                    ids=[page_id],
                    documents=[search_text],
                    metadatas=[{
                        "url": url,
                        "title": title,
                        "domain": domain,
                        "timestamp": now
                    }]
                )
            except Exception as e:
                print(f"[Memory] Vector store error: {e}")
        
        return {
            "id": page_id,
            "url": url,
            "title": title,
            "stored": True
        }
    
    async def search(
        self,
        query: str,
        limit: int = 10,
        domain: Optional[str] = None,
        min_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search memory using semantic similarity"""
        
        results = []
        
        # Vector search if available
        if self.collection and self.collection.count() > 0:
            try:
                vector_results = self.collection.query(
                    query_texts=[query],
                    n_results=min(limit, self.collection.count())
                )
                
                for i, doc_id in enumerate(vector_results['ids'][0]):
                    metadata = vector_results['metadatas'][0][i]
                    results.append({
                        "id": doc_id,
                        "url": metadata.get("url"),
                        "title": metadata.get("title"),
                        "domain": metadata.get("domain"),
                        "score": 1 - (vector_results['distances'][0][i] if vector_results.get('distances') else 0),
                        "source": "vector"
                    })
            except Exception as e:
                print(f"[Memory] Vector search error: {e}")
        
        # Fallback/supplement with SQLite full-text search
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Simple keyword search
        keywords = query.lower().split()
        like_clauses = " OR ".join([f"(title LIKE ? OR content LIKE ?)" for _ in keywords])
        params = []
        for kw in keywords:
            params.extend([f"%{kw}%", f"%{kw}%"])
        
        sql = f'''
            SELECT id, url, title, domain, summary, last_visit, visit_count
            FROM pages
            WHERE {like_clauses}
        '''
        
        if domain:
            sql += " AND domain = ?"
            params.append(domain)
        
        if min_date:
            sql += " AND last_visit >= ?"
            params.append(min_date)
        
        sql += " ORDER BY visit_count DESC, last_visit DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(sql, params)
        
        for row in cursor.fetchall():
            # Check if already in results
            if not any(r['id'] == row[0] for r in results):
                results.append({
                    "id": row[0],
                    "url": row[1],
                    "title": row[2],
                    "domain": row[3],
                    "summary": row[4],
                    "last_visit": row[5],
                    "visit_count": row[6],
                    "source": "keyword"
                })
        
        conn.close()
        
        return results[:limit]
    
    async def get_page(self, url: str) -> Optional[Dict[str, Any]]:
        """Get a specific page from memory"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, url, title, domain, content, summary, first_visit, last_visit, visit_count, tags, metadata
            FROM pages WHERE url = ?
        ''', (url,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "id": row[0],
                "url": row[1],
                "title": row[2],
                "domain": row[3],
                "content": row[4],
                "summary": row[5],
                "first_visit": row[6],
                "last_visit": row[7],
                "visit_count": row[8],
                "tags": json.loads(row[9] or "[]"),
                "metadata": json.loads(row[10] or "{}")
            }
        return None
    
    async def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently visited pages"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, url, title, domain, summary, last_visit, visit_count
            FROM pages
            ORDER BY last_visit DESC
            LIMIT ?
        ''', (limit,))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "url": row[1],
                "title": row[2],
                "domain": row[3],
                "summary": row[4],
                "last_visit": row[5],
                "visit_count": row[6]
            })
        
        conn.close()
        return results
    
    async def get_related(self, url: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get pages related to a given URL"""
        
        # Get the page content for similarity search
        page = await self.get_page(url)
        if not page:
            return []
        
        # Use vector search to find similar pages
        if self.collection:
            try:
                search_text = f"{page['title']}\n{page.get('summary', '')}"
                results = self.collection.query(
                    query_texts=[search_text],
                    n_results=limit + 1,  # +1 to exclude self
                    where={"url": {"$ne": url}}
                )
                
                related = []
                for i, doc_id in enumerate(results['ids'][0]):
                    if results['metadatas'][0][i].get("url") != url:
                        related.append({
                            "id": doc_id,
                            "url": results['metadatas'][0][i].get("url"),
                            "title": results['metadatas'][0][i].get("title"),
                            "similarity": 1 - (results['distances'][0][i] if results.get('distances') else 0)
                        })
                
                return related[:limit]
            except Exception as e:
                print(f"[Memory] Related search error: {e}")
        
        # Fallback: same domain
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, url, title FROM pages
            WHERE domain = ? AND url != ?
            ORDER BY visit_count DESC
            LIMIT ?
        ''', (page['domain'], url, limit))
        
        results = [{"id": r[0], "url": r[1], "title": r[2]} for r in cursor.fetchall()]
        conn.close()
        
        return results
    
    async def add_note(
        self,
        page_url: str,
        content: str,
        tags: List[str] = None
    ) -> Dict[str, Any]:
        """Add a note to a page"""
        
        # Get page ID
        page = await self.get_page(page_url)
        if not page:
            return {"error": "Page not found in memory"}
        
        note_id = self._generate_id(f"{page_url}:{content}:{datetime.now().isoformat()}")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO notes (id, page_id, content, created_at, tags)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            note_id,
            page['id'],
            content,
            datetime.now().isoformat(),
            json.dumps(tags or [])
        ))
        
        conn.commit()
        conn.close()
        
        return {
            "id": note_id,
            "page_id": page['id'],
            "content": content,
            "created": True
        }
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        stats = {}
        
        cursor.execute('SELECT COUNT(*) FROM pages')
        stats['total_pages'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(DISTINCT domain) FROM pages')
        stats['unique_domains'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM entities')
        stats['total_entities'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM notes')
        stats['total_notes'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT SUM(visit_count) FROM pages')
        stats['total_visits'] = cursor.fetchone()[0] or 0
        
        if self.collection:
            stats['vector_documents'] = self.collection.count()
        
        conn.close()
        return stats
    
    async def delete_page(self, url: str) -> bool:
        """Delete a page from memory"""
        page = await self.get_page(url)
        if not page:
            return False
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Delete related data
        cursor.execute('DELETE FROM page_entities WHERE page_id = ?', (page['id'],))
        cursor.execute('DELETE FROM notes WHERE page_id = ?', (page['id'],))
        cursor.execute('DELETE FROM pages WHERE id = ?', (page['id'],))
        
        conn.commit()
        conn.close()
        
        # Remove from vector store
        if self.collection:
            try:
                self.collection.delete(ids=[page['id']])
            except:
                pass
        
        return True
    
    async def clear_all(self) -> bool:
        """Clear all memory data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM page_entities')
        cursor.execute('DELETE FROM entities')
        cursor.execute('DELETE FROM notes')
        cursor.execute('DELETE FROM pages')
        
        conn.commit()
        conn.close()
        
        # Clear vector store
        if self.vector_db and self.collection:
            try:
                self.vector_db.delete_collection("pages")
                self.collection = self.vector_db.create_collection(
                    name="pages",
                    metadata={"hnsw:space": "cosine"}
                )
            except:
                pass
        
        return True


# Singleton instance
memory = MemoryStore()
