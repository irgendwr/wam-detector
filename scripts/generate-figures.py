#!/bin/env python

import argparse
import matplotlib.pyplot as plt
import plot_utils as pu

total = 16000
successfull = 13134
unsuccessfull = total-successfull
https = 12047
modified = 8091
unmodified = successfull-modified
corejs = 5661
externalmod = 7020
externalpoly = 671

pre=r'\begin{center}'
post=r'\end{center}'

def make_autopct(values):
    def my_autopct(pct):
        total = sum(values)
        val = int(round(pct*total/100.0))
        return pre+f'{pct:.2f}\\%\\\\({val:d})'+post
    return my_autopct

def main(args):
    pu.figure_setup()

    # make figure and assign axis objects
    fig, (ax1, ax2) = plt.subplots(1, 2,
        figsize=(8.27,3.5), # A4 landscape: 11.69,8.27
        gridspec_kw={'width_ratios': [0.44, 0.56]},
    )
    fig.subplots_adjust(left=0, right=0.948)

    # pie chart
    pValues = [successfull, unsuccessfull]
    pLabels = ['Successful\nResults', 'Failures']
    explode = [0.05, 0]
    angle = -225 * (pValues[0])/total
    ax1.pie(pValues, autopct=make_autopct(pValues), startangle=angle, labels=pLabels, explode=explode)

    # bar chart
    bLabels = [
        pre+r'HTTPS\\Redirect'+post,
        pre+r'Browser API\\Modification'+post,
        pre+r'External\\Modification'+post,
        pre+r'core-js\\Polyfill'+post,
        pre+r'External\\Polyfill'+post,
    ]
    bValues = [
        https/successfull*100,
        modified/successfull*100,
        externalmod/successfull*100,
        corejs/successfull*100,
        externalpoly/successfull*100,
    ]
    width = 0.45

    bars = ax2.bar(bLabels, bValues, width)

    ax2.set_ylabel('Percent of Successful R.')
    #x2.set_title('Results')

    i = 0
    for bar in bars:
        width = bar.get_width()
        height = bar.get_height()
        x, y = bar.get_xy()
        value = bValues[i]
        plt.text(x+width/2,
                y+height + 1,
                f'{value:.2f}\\%',
                ha='center')
        i+=1

    if args.save:
        pu.save_fig(fig, args.save)
    else:
        plt.show()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    # eg. 'evaluation-overview.pdf'
    parser.add_argument('-s', '--save', type=str)

    args = parser.parse_args()
    main(args)
