import sys

def anagram_count(s):
    if len(s) == 0:
        sys.stdout.write("empty")
    elif not s.isalpha():
        sys.stderr.write("invalid")
    else:
        d = {c: s.lower().count(c) for c in s.lower()}
        l = d.values()
        sys.stdout.write(str(_multinomial_coeff(l)))

def _factorial(n):
    if n == 1:
        return n
    else:
        return n*_factorial(n-1)

def _multinomial_coeff(n_list):
    denom = 1
    for n in n_list:
        denom *= _factorial(n)
    return int(_factorial(sum(n_list))/denom)

def main():
    s = ""
    if len(sys.argv) == 2:
        s = sys.argv[1]
    elif len(sys.argv) > 2:
        s = "!"
    
    anagram_count(s)

if __name__ == "__main__":
    main()