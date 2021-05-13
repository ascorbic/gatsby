import path from "path"
import fs from "fs-extra"
import reporter from "gatsby-cli/lib/reporter"
import { store } from "../../redux"

import { INodeManifest } from "./../../redux/types"

import {
  warnAboutNodeManifestMappingProblems,
  processNodeManifests,
  processNodeManifest,
} from "../node-manifest"

jest.mock(`fs-extra`, () => {
  return {
    ensureDir: jest.fn(),
    writeJSON: jest.fn((manifestFilePath, finalManifest) => {
      return { manifestFilePath, finalManifest }
    }),
  }
})

jest.mock(`gatsby-cli/lib/reporter`, () => {
  return {
    warn: jest.fn(message => {
      if (process.env.DEBUG) {
        console.warn(message)
      }
      return message
    }),
    info: jest.fn(message => {
      if (process.env.DEBUG) {
        console.info(message)
      }
      return message
    }),
  }
})

jest.mock(`../../redux`, () => {
  const initialState = {
    nodeManifests: [],
    nodes: new Map(),
    program: {
      directory: process.cwd(),
    },
  }

  const state = { ...initialState }

  return {
    store: {
      getState: jest.fn(() => state),
      getNode: (nodeId: string): { id: string } | undefined =>
        state.nodes.get(nodeId),
      setManifests: (manifests): void => {
        state.nodeManifests = manifests
      },
      createNode: node => {
        state.nodes.set(node.id, node)
      },
      dispatch: jest.fn(),
    },
  }
})

describe(`warnAboutNodeManifestMappingProblems`, () => {
  afterEach(() => {
    // @ts-ignore: reporter is mocked
    reporter.warn.mockReset()
  })

  it(`warns about no page found for manifest node id`, () => {
    const { message, possibleMessages } = warnAboutNodeManifestMappingProblems({
      inputManifest: {
        pluginName: `test`,
        node: { id: `1` },
        manifestId: `1`,
      },
      pagePath: undefined,
      foundPageBy: `none`,
    })

    expect(reporter.warn).toBeCalled()
    expect(reporter.warn).toBeCalledWith(possibleMessages.none)
    expect(message).toEqual(possibleMessages.none)
    expect(message.includes(`couldn't find a page for this node`)).toBeTruthy()
  })

  it(`warns about using context.id to map from node->page instead of ownerNodeId`, () => {
    const { message, possibleMessages } = warnAboutNodeManifestMappingProblems({
      inputManifest: {
        pluginName: `test`,
        node: { id: `1` },
        manifestId: `1`,
      },
      pagePath: `/test`,
      foundPageBy: `context.id`,
    })

    expect(reporter.warn).toBeCalled()
    expect(reporter.warn).toBeCalledWith(possibleMessages[`context.id`])
    expect(message).toEqual(possibleMessages[`context.id`])
    expect(message.includes(`pageContext.id`)).toBeTruthy()
    expect(message.includes(`ownerNodeId`)).toBeTruthy()
  })

  it(`warns about using node->query tracking to map from node->page instead of using ownerNodeId`, () => {
    const { message, possibleMessages } = warnAboutNodeManifestMappingProblems({
      inputManifest: {
        pluginName: `test`,
        node: { id: `1` },
        manifestId: `1`,
      },
      pagePath: `/test`,
      foundPageBy: `queryTracking`,
    })

    expect(reporter.warn).toBeCalled()
    expect(reporter.warn).toBeCalledWith(possibleMessages[`queryTracking`])
    expect(message).toEqual(possibleMessages[`queryTracking`])
    expect(
      message.includes(`the first page where this node is queried`)
    ).toBeTruthy()
  })

  it(`doesn't warn when using the filesystem route api to map nodes->pages`, () => {
    const { message } = warnAboutNodeManifestMappingProblems({
      inputManifest: {
        pluginName: `test`,
        node: { id: `1` },
        manifestId: `1`,
      },
      pagePath: `/test`,
      foundPageBy: `filesystem-route-api`,
    })

    expect(reporter.warn).not.toBeCalled()
    expect(message).toEqual(`success`)
  })

  it(`doesn't warn when using the filesystem route api to map nodes->pages`, () => {
    const { message } = warnAboutNodeManifestMappingProblems({
      inputManifest: {
        pluginName: `test`,
        node: { id: `1` },
        manifestId: `1`,
      },
      pagePath: `/test`,
      foundPageBy: `ownerNodeId`,
    })

    expect(reporter.warn).not.toBeCalled()
    expect(message).toEqual(`success`)
  })

  it(`warnings helper throws in impossible foundPageBy state`, () => {
    expect(() =>
      warnAboutNodeManifestMappingProblems({
        pagePath: undefined,
        // @ts-ignore: intentionally doing the wrong thing here
        inputManifest: null,
        // @ts-ignore: intentionally doing the wrong thing here
        foundPageBy: `nope`,
      })
    ).toThrow()
  })
})

describe(`processNodeManifests`, () => {
  beforeEach(() => {
    store.setManifests([])
  })

  it(`Doesn't do anything special when there are no pending manifests`, async () => {
    const processNodeManifestFn = jest.fn()

    await processNodeManifests({
      processNodeManifestFn,
    })

    expect(processNodeManifestFn).not.toBeCalled()
    expect(reporter.info).not.toBeCalled()
    expect(store.dispatch).not.toBeCalled()
  })

  it(`accurately logs out how many manifest files were written to disk`, async () => {
    store.setManifests([{}, {}, {}])

    const processNodeManifestFn = jest.fn()

    await processNodeManifests({
      processNodeManifestFn,
    })

    expect(processNodeManifestFn.mock.calls.length).toBe(3)
    expect(reporter.info).toBeCalled()
    expect(reporter.info).toBeCalledWith(`Wrote out 3 node page manifest files`)
    expect(store.dispatch).toBeCalled()
  })
})

describe(`processNodeManifest`, () => {
  it(`processes node manifests`, async () => {
    const nodes = [{ id: `1` }, { id: `2` }, { id: `3` }]

    nodes.forEach(store.createNode)

    const pendingManifests: Array<INodeManifest> = [
      {
        pluginName: `test`,
        manifestId: `1`,
        node: { id: `1` },
      },
      {
        pluginName: `test`,
        manifestId: `2`,
        node: { id: `2` },
      },
      {
        pluginName: `test`,
        manifestId: `3`,
        node: { id: `3` },
      },
      {
        pluginName: `test`,
        manifestId: `4`,
        node: { id: `4` },
      },
    ]

    const findPageOwnedByNodeIdFn = jest.fn(({ nodeId }) => {
      return {
        page: {
          path: `/${nodeId}`,
        },
        foundPageBy: `pageContext.id`,
      }
    })

    const warnAboutNodeManifestMappingProblemsFn = jest.fn()

    await Promise.all(
      pendingManifests.map(manifest =>
        processNodeManifest(manifest, {
          findPageOwnedByNodeIdFn,
          warnAboutNodeManifestMappingProblemsFn,
        })
      )
    )

    expect(reporter.warn).toBeCalled()
    expect(reporter.warn).toBeCalledWith(
      `Plugin test called unstable_createNodeManifest for a node which doesn't exist with an id of 4.`
    )

    expect(warnAboutNodeManifestMappingProblemsFn.mock.calls.length).toBe(
      nodes.length
    )
    expect(findPageOwnedByNodeIdFn.mock.calls.length).toBe(nodes.length)

    expect(fs.ensureDir.mock.calls.length).toBe(nodes.length)
    expect(fs.writeJSON.mock.calls.length).toBe(nodes.length)

    pendingManifests.forEach((manifest, index) => {
      if (!store.getNode(manifest.node.id)) {
        return
      }

      const jsonResults = fs.writeJSON.mock.results[index].value

      expect(jsonResults.manifestFilePath).toBe(
        `${path.join(process.cwd(), `.cache`, `node-manifests`, `test`)}/${
          manifest.manifestId
        }.json`
      )

      expect(jsonResults.finalManifest.page.path).toBe(`/${manifest.node.id}`)
    })
  })
})
