from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
from datetime import datetime as dt
from os.path import exists
from math import factorial
from itertools import permutations
import json

class MyHTTPRequestHandler(BaseHTTPRequestHandler):
    num_req = 0
    error_count = 0
    secret_content = ""

    def _multinomial_coeff(self, n_list):
        denom = 1
        for n in n_list:
            denom *= factorial(n)
        return int(factorial(sum(n_list))/denom)

    def _anagram_generator(self, s, limit):
        if len(s) == 0 or not s.isalpha():
            return -1, []
        else:
            d = {c: s.lower().count(c) for c in s.lower()}
            l = d.values()
            n = self._multinomial_coeff(l)

            if n == 1:
                return n, [s]
            
            sorted_s = sorted(s)
            tmp_s = ""
            f_s = ""
            res = []

            if len(sorted_s) >= 5:
                tmp_s = sorted_s[(len(sorted_s)-5):]
                f_s = sorted_s[:(len(sorted_s)-5)]
                full_s = ''.join(f_s)
                s_list = sorted(list(tmp_s), key=str.casefold)
                p_list = list(permutations(s_list))
                temp_list = [''.join(p) for p in p_list]
                anagrams = []
                upper = []

                for t in temp_list:
                    if len(anagrams) == limit:
                        break
                    if t.upper() not in upper:
                        anagrams.append(t)
                        upper.append(t.upper())

                full_list = []
                for a in anagrams:
                    tmp_string = ''.join(a)
                    full_list.append(full_s + tmp_string)

                res = sorted(full_list, key=str.casefold)
            else:
                s_list = sorted(list(s), key=str.casefold)
                p_list = list(permutations(s_list))
                p_list = p_list[:limit]
                temp_list = [''.join(p) for p in p_list]
                anagrams = []
                upper = []

                for t in temp_list:
                    if t.upper() not in upper:
                        anagrams.append(t)
                        upper.append(t.upper())
            
                res = sorted(list(anagrams), key=str.casefold)

        return n, res

    def _shuffle_GET(self):
        query_string = self.path.partition("?")[2]
        query = parse_qs(query_string, keep_blank_values=True)

        p = ""
        if "p" in query:
            p = query['p'][0]
        else:
            self.send_response(400)
            self.end_headers()
            return

        l = 4
        if "limit" in query:
            if query["limit"][0] and query["limit"][0].isdigit():
                l = int(query["limit"][0])
            else:
                self.send_response(400)
                self.end_headers()
                return

        if l < 0:
            l = 0
        elif l > 25:
            l = 25

        n, anagrams = self._anagram_generator(p, l)
        if n != -1:
            d = {}
            d["p"] = p
            d["total"] = n
            d["page"] = anagrams

            res = json.dumps(d).encode('utf-8')

            self.send_response(200)
            self.end_headers()
            self.wfile.write(res)
        else:
            self.send_response(400)
            self.end_headers()

    def _status_GET(self):
        curr_time = dt.now().replace(microsecond=0).astimezone().isoformat()

        d = {}
        d["time"] = curr_time
        d["req"] = MyHTTPRequestHandler.num_req
        d["err"] = MyHTTPRequestHandler.error_count

        res = json.dumps(d).encode('utf-8')

        self.send_response(200)
        self.end_headers()
        self.wfile.write(res)

    def _secret_GET(self):
        tmp_path = "/tmp/secret.key"
        if exists(tmp_path):
            with open(tmp_path) as w:
                MyHTTPRequestHandler.secret_content = w.read()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(str.encode(MyHTTPRequestHandler.secret_content))
        else:
            MyHTTPRequestHandler.error_count += 1
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        MyHTTPRequestHandler.num_req += 1
        path = self.path.partition("?")[0]

        if path == "/ping":
            self.send_response(204)
            self.end_headers()
        elif path == "/shuffle":
            self._shuffle_GET()
        elif path == "/status":
            self._status_GET()
        elif path == "/secret":
            self._secret_GET()
        else:
            MyHTTPRequestHandler.error_count += 1
            self.send_response(404)
            self.end_headers()

def main():
    httpd = HTTPServer(("localhost", 8088), MyHTTPRequestHandler)
    httpd.serve_forever()

if __name__ == "__main__":
    main()