"""Shipped HTML must carry the deployed Pages URL, never the template placeholder."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1]
PLACEHOLDER = '__DEPLOY_URL__'
DEPLOY_URL = 'https://visualsubnetcalculator.pages.dev'


class MetaCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        if tag != 'meta':
            return
        values = dict(attrs)
        key = values.get('property') or values.get('name')
        if key:
            self.meta[key] = values.get('content')


class ShippedSiteUrls(unittest.TestCase):
    def test_no_placeholder_remains_in_shipped_html(self):
        pages = sorted((SOURCE / 'src').glob('*.html'))
        self.assertTrue(pages, 'expected HTML pages under src/')
        for page in pages:
            self.assertNotIn(PLACEHOLDER, page.read_text(encoding='utf-8'), page.name)

    def test_social_meta_points_at_pages_dev_deployment(self):
        collector = MetaCollector()
        collector.feed((SOURCE / 'src/index.html').read_text(encoding='utf-8'))
        self.assertEqual(collector.meta.get('og:url'), DEPLOY_URL + '/')
        self.assertEqual(collector.meta.get('og:image'), DEPLOY_URL + '/icon/social_1200x630.png')
        self.assertEqual(collector.meta.get('twitter:url'), DEPLOY_URL + '/')
        self.assertEqual(collector.meta.get('twitter:image'), DEPLOY_URL + '/icon/social_1200x600.png')


if __name__ == '__main__':
    unittest.main()
